//! Backend for Bloom's own Start menu in the dock: recent files, the
//! signed-in user's name, power actions, known folders, Settings pages, and
//! giving the dock keyboard focus while Start's search is open.

use serde::Serialize;
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct RecentFile {
    /// File name with its extension, as Windows shows it in Recent.
    pub name: String,
    /// The file itself (the shortcut's target).
    pub path: String,
    /// Lower-case extension without the dot ("pdf"), for the icon.
    pub ext: String,
    /// Folder the file lives in, for the second line.
    pub folder: String,
    /// When it was last opened, Unix ms.
    pub opened: i64,
}

/// "report.pdf.lnk" -> Some("report.pdf"). Folder shortcuts ("Downloads.lnk")
/// and other entries without an extension of their own are skipped.
pub fn recent_name(file_name: &str) -> Option<String> {
    let name = file_name.strip_suffix(".lnk")?;
    let (stem, ext) = name.rsplit_once('.')?;
    if stem.is_empty() || ext.is_empty() || ext.len() > 8 || ext.contains(' ') {
        return None;
    }
    Some(name.to_string())
}

pub fn extension(name: &str) -> String {
    name.rsplit_once('.')
        .map(|(_, e)| e.to_ascii_lowercase())
        .unwrap_or_default()
}

fn recent_sync(limit: usize) -> Vec<RecentFile> {
    let Some(appdata) = std::env::var_os("APPDATA") else {
        return Vec::new();
    };
    let dir = std::path::Path::new(&appdata).join("Microsoft\\Windows\\Recent");
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut candidates: Vec<(std::time::SystemTime, std::path::PathBuf, String)> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let file_name = e.file_name().to_string_lossy().to_string();
            let name = recent_name(&file_name)?;
            let modified = e.metadata().ok()?.modified().ok()?;
            Some((modified, e.path(), name))
        })
        .collect();
    candidates.sort_by(|a, b| b.0.cmp(&a.0));

    unsafe {
        let _ = windows::Win32::System::Com::CoInitializeEx(
            None,
            windows::Win32::System::Com::COINIT_APARTMENTTHREADED,
        );
    }
    let mut out = Vec::new();
    for (modified, lnk, name) in candidates.into_iter().take(limit * 3) {
        if out.len() >= limit {
            break;
        }
        let Some((target, _)) = crate::utils::resolve_shortcut(&lnk.to_string_lossy()) else {
            continue;
        };
        let path = std::path::Path::new(&target);
        if !path.is_file() {
            continue;
        }
        let folder = path
            .parent()
            .and_then(|p| p.file_name())
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();
        let opened = modified
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        out.push(RecentFile {
            ext: extension(&name),
            name,
            path: target,
            folder,
            opened,
        });
    }
    out
}

/// Files you opened recently, newest first, from Windows' Recent folder.
#[tauri::command]
pub async fn get_recent_files(limit: Option<usize>) -> Vec<RecentFile> {
    let limit = limit.unwrap_or(8).clamp(1, 40);
    tauri::async_runtime::spawn_blocking(move || recent_sync(limit))
        .await
        .unwrap_or_default()
}

/// The signed-in user's display name, or the account name.
#[tauri::command]
pub fn get_user_display_name() -> String {
    use windows::Win32::Security::Authentication::Identity::{GetUserNameExW, NameDisplay};
    unsafe {
        let mut buf = [0u16; 256];
        let mut len = buf.len() as u32;
        if GetUserNameExW(NameDisplay, Some(windows::core::PWSTR(buf.as_mut_ptr())), &mut len)
            && len > 0
        {
            let name = String::from_utf16_lossy(&buf[..len as usize]);
            if !name.trim().is_empty() {
                return name.trim().to_string();
            }
        }
    }
    std::env::var("USERNAME").unwrap_or_default()
}

/// Sleep, lock, sign out, restart or shut down, as Start's power menu does.
#[tauri::command]
pub fn power_action(action: String) -> Result<(), String> {
    let run = |exe: &str, args: &[&str]| {
        std::process::Command::new(exe)
            .args(args)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    };
    match action.as_str() {
        "sleep" => {
            std::thread::spawn(|| unsafe {
                let _ = windows::Win32::System::Power::SetSuspendState(false, false, false);
            });
            Ok(())
        }
        "lock" => run("rundll32.exe", &["user32.dll,LockWorkStation"]),
        "signout" => run("shutdown.exe", &["/l"]),
        "restart" => run("shutdown.exe", &["/r", "/t", "0"]),
        "shutdown" => run("shutdown.exe", &["/s", "/t", "0"]),
        _ => Err(format!("Unknown power action: {action}")),
    }
}

/// Opens a known folder (Downloads, Documents, Pictures, Music, Videos) in File Explorer.
#[tauri::command]
pub fn open_known_folder(name: String) -> Result<(), String> {
    let shell = match name.as_str() {
        "downloads" => "shell:Downloads",
        "documents" => "shell:Personal",
        "pictures" => "shell:My Pictures",
        "music" => "shell:My Music",
        "videos" => "shell:My Video",
        _ => return Err(format!("Unknown folder: {name}")),
    };
    std::process::Command::new("explorer.exe")
        .arg(shell)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Opens one Settings page. Only `ms-settings:` links are accepted.
pub fn is_settings_uri(uri: &str) -> bool {
    uri.starts_with("ms-settings:")
        && uri.len() < 80
        && uri[12..]
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[tauri::command]
pub fn open_settings_page(uri: String) -> Result<(), String> {
    if !is_settings_uri(&uri) {
        return Err("Not a Settings page".into());
    }
    tauri_plugin_opener::open_url(&uri, None::<&str>).map_err(|e| e.to_string())
}

/// Gives the dock keyboard focus (it normally never takes it), so Start's
/// search box can be typed into. Returns the window that had focus, for
/// `restore_foreground` when Start closes.
#[tauri::command]
pub fn focus_dock_window(window: tauri::WebviewWindow) -> isize {
    use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId, SetForegroundWindow,
    };
    unsafe {
        let previous = GetForegroundWindow();
        if let Ok(hwnd) = window.hwnd() {
            // Opened from the Windows key, the keypress went to another app, and
            // Windows only lets the app that owns the input take the foreground.
            // Sharing that app's input state for a moment lets the dock take it.
            let theirs = GetWindowThreadProcessId(previous, None);
            let ours = GetCurrentThreadId();
            let attached =
                theirs != 0 && theirs != ours && AttachThreadInput(theirs, ours, true).as_bool();
            let _ = SetForegroundWindow(hwnd);
            if attached {
                let _ = AttachThreadInput(theirs, ours, false);
            }
        }
        let _ = window.set_focus();
        previous.0 as isize
    }
}

/// Hands focus back to the window that had it before Start opened, unless
/// something else has taken it since.
#[tauri::command]
pub fn restore_foreground(window: tauri::WebviewWindow, previous: isize) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, IsWindow, SetForegroundWindow};
    if previous == 0 {
        return;
    }
    unsafe {
        let Ok(dock) = window.hwnd() else {
            return;
        };
        if GetForegroundWindow() != dock {
            return;
        }
        let prev = HWND(previous as *mut _);
        if IsWindow(Some(prev)).as_bool() {
            let _ = SetForegroundWindow(prev);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recent_names_keep_files_and_skip_folders() {
        assert_eq!(recent_name("report.pdf.lnk").as_deref(), Some("report.pdf"));
        assert_eq!(recent_name("COS226 v2.final.docx.lnk").as_deref(), Some("COS226 v2.final.docx"));
        assert_eq!(recent_name("Downloads.lnk"), None);
        assert_eq!(recent_name("report.pdf"), None);
        assert_eq!(recent_name("My Folder.some thing.lnk"), None);
    }

    #[test]
    fn extensions_are_lower_case() {
        assert_eq!(extension("Notes.PDF"), "pdf");
        assert_eq!(extension("noext"), "");
    }

    #[test]
    fn only_settings_links_open() {
        assert!(is_settings_uri("ms-settings:network-wifi"));
        assert!(is_settings_uri("ms-settings:"));
        assert!(!is_settings_uri("https://example.com"));
        assert!(!is_settings_uri("ms-settings:wifi&x=1"));
    }
}
