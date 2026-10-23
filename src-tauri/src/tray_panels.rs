//! Backend for the dock's tray end: the notifications Windows shares with
//! Bloom, the keyboard language indicator, and a few small helpers for the
//! quick settings and calendar panels.
//!
//! Notifications come from `UserNotificationListener`. Windows only hands
//! them to apps the user has allowed, and on some builds only to packaged
//! apps, so every call reports an access state and the panel falls back to
//! opening Windows' own notification centre when access isn't available.

use serde::Serialize;
use std::sync::atomic::Ordering;

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct NotificationItem {
    pub id: u32,
    /// The sender's AppUserModelID, used to open the app.
    pub app_id: String,
    pub app_name: String,
    pub title: String,
    pub body: String,
    /// Unix time in milliseconds.
    pub time: i64,
}

#[derive(Serialize)]
pub struct NotificationList {
    /// "allowed", "denied", "unspecified" (never asked) or "unsupported".
    pub access: &'static str,
    pub items: Vec<NotificationItem>,
}

/// WinRT `DateTime` counts 100 ns ticks from 1601-01-01 UTC.
pub fn winrt_ticks_to_unix_ms(ticks: i64) -> i64 {
    ticks / 10_000 - 11_644_473_600_000
}

/// The first text line of a toast is its title; the rest is the body.
pub fn split_toast_text(lines: &[String]) -> (String, String) {
    let mut lines = lines.iter().map(|l| l.trim()).filter(|l| !l.is_empty());
    let title = lines.next().unwrap_or_default().to_string();
    let body = lines.collect::<Vec<_>>().join("\n");
    (title, body)
}

/// Newest first, at most `limit`.
pub fn newest_first(mut items: Vec<NotificationItem>, limit: usize) -> Vec<NotificationItem> {
    items.sort_by(|a, b| b.time.cmp(&a.time).then(b.id.cmp(&a.id)));
    items.truncate(limit);
    items
}

const MAX_NOTIFICATIONS: usize = 40;

fn init_apartment() {
    unsafe {
        let _ = windows::Win32::System::Com::CoInitializeEx(
            None,
            windows::Win32::System::Com::COINIT_MULTITHREADED,
        );
    }
}

fn access_name(
    status: windows::UI::Notifications::Management::UserNotificationListenerAccessStatus,
) -> &'static str {
    use windows::UI::Notifications::Management::UserNotificationListenerAccessStatus as S;
    if status == S::Allowed {
        "allowed"
    } else if status == S::Denied {
        "denied"
    } else {
        "unspecified"
    }
}

fn read_notification(n: &windows::UI::Notifications::UserNotification) -> Option<NotificationItem> {
    use windows::UI::Notifications::KnownNotificationBindings;

    let id = n.Id().ok()?;
    let (app_id, app_name) = match n.AppInfo() {
        Ok(info) => (
            info.AppUserModelId()
                .map(|s| s.to_string())
                .unwrap_or_default(),
            info.DisplayInfo()
                .and_then(|d| d.DisplayName())
                .map(|s| s.to_string())
                .unwrap_or_default(),
        ),
        Err(_) => (String::new(), String::new()),
    };

    let mut lines = Vec::new();
    if let Ok(template) = KnownNotificationBindings::ToastGeneric() {
        if let Ok(binding) = n
            .Notification()
            .and_then(|x| x.Visual())
            .and_then(|v| v.GetBinding(&template))
        {
            if let Ok(elements) = binding.GetTextElements() {
                let count = elements.Size().unwrap_or(0);
                for i in 0..count {
                    if let Ok(text) = elements.GetAt(i).and_then(|e| e.Text()) {
                        lines.push(text.to_string());
                    }
                }
            }
        }
    }
    let (title, body) = split_toast_text(&lines);
    let time = n
        .CreationTime()
        .map(|d| winrt_ticks_to_unix_ms(d.UniversalTime))
        .unwrap_or(0);

    Some(NotificationItem {
        id,
        app_id,
        app_name,
        title,
        body,
        time,
    })
}

fn list_sync() -> NotificationList {
    use windows::UI::Notifications::Management::{
        UserNotificationListener, UserNotificationListenerAccessStatus,
    };
    use windows::UI::Notifications::NotificationKinds;

    init_apartment();
    let unsupported = NotificationList {
        access: "unsupported",
        items: Vec::new(),
    };
    let Ok(listener) = UserNotificationListener::Current() else {
        return unsupported;
    };
    let Ok(status) = listener.GetAccessStatus() else {
        return unsupported;
    };
    if status != UserNotificationListenerAccessStatus::Allowed {
        return NotificationList {
            access: access_name(status),
            items: Vec::new(),
        };
    }
    let Ok(view) = listener
        .GetNotificationsAsync(NotificationKinds::Toast)
        .and_then(|op| op.get())
    else {
        return unsupported;
    };
    let count = view.Size().unwrap_or(0);
    let items = (0..count)
        .filter_map(|i| view.GetAt(i).ok())
        .filter_map(|n| read_notification(&n))
        .collect();
    NotificationList {
        access: "allowed",
        items: newest_first(items, MAX_NOTIFICATIONS),
    }
}

#[tauri::command]
pub async fn notifications_list() -> NotificationList {
    tauri::async_runtime::spawn_blocking(list_sync)
        .await
        .unwrap_or(NotificationList {
            access: "unsupported",
            items: Vec::new(),
        })
}

/// Asks Windows for access. Windows shows its own prompt the first time;
/// after that the answer lives in Settings > Privacy > Notifications.
#[tauri::command]
pub async fn notifications_request_access() -> &'static str {
    tauri::async_runtime::spawn_blocking(|| {
        use windows::UI::Notifications::Management::UserNotificationListener;
        init_apartment();
        let Ok(listener) = UserNotificationListener::Current() else {
            return "unsupported";
        };
        match listener.RequestAccessAsync().and_then(|op| op.get()) {
            Ok(status) => access_name(status),
            Err(_) => "unsupported",
        }
    })
    .await
    .unwrap_or("unsupported")
}

#[tauri::command]
pub async fn notifications_remove(id: u32) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use windows::UI::Notifications::Management::UserNotificationListener;
        init_apartment();
        UserNotificationListener::Current()
            .and_then(|l| l.RemoveNotification(id))
            .map_err(|e| e.message().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn notifications_clear() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        use windows::UI::Notifications::Management::UserNotificationListener;
        init_apartment();
        UserNotificationListener::Current()
            .and_then(|l| l.ClearNotifications())
            .map_err(|e| e.message().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
pub struct InputLanguage {
    /// Three-letter language code, upper case ("ENG").
    pub code: String,
    /// Installed keyboard layouts. Windows shows the indicator when there are two or more.
    pub layouts: u32,
}

/// The foreground window's keyboard language, like the taskbar's indicator.
#[tauri::command]
pub fn get_input_language() -> InputLanguage {
    use windows::Win32::Globalization::{GetLocaleInfoW, LOCALE_SISO639LANGNAME2};
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyboardLayout, GetKeyboardLayoutList};
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    unsafe {
        let thread = GetWindowThreadProcessId(GetForegroundWindow(), None);
        let layout = GetKeyboardLayout(thread);
        let lang_id = (layout.0 as usize & 0xffff) as u32;
        let mut buf = [0u16; 16];
        let len = GetLocaleInfoW(lang_id, LOCALE_SISO639LANGNAME2, Some(&mut buf));
        let code = if len > 1 {
            String::from_utf16_lossy(&buf[..len as usize - 1]).to_uppercase()
        } else {
            String::new()
        };
        let layouts = GetKeyboardLayoutList(None).max(0) as u32;
        InputLanguage { code, layouts }
    }
}

/// Opens Windows' input switcher (Win+Space), as clicking the indicator does.
#[tauri::command]
pub fn open_input_switcher() {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
        VIRTUAL_KEY, VK_LWIN, VK_SPACE,
    };
    let key = |vk: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    let inputs = [
        key(VK_LWIN, KEYBD_EVENT_FLAGS(0)),
        key(VK_SPACE, KEYBD_EVENT_FLAGS(0)),
        key(VK_SPACE, KEYEVENTF_KEYUP),
        key(VK_LWIN, KEYEVENTF_KEYUP),
    ];
    std::thread::spawn(move || unsafe {
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    });
}

/// Media updates are only sent when something changes, so a window that
/// opens later asks for the current state to be sent again.
#[tauri::command]
pub fn request_media_update() {
    crate::state::MEDIA_RESEND.store(true, Ordering::Relaxed);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: u32, time: i64) -> NotificationItem {
        NotificationItem {
            id,
            app_id: String::new(),
            app_name: String::new(),
            title: String::new(),
            body: String::new(),
            time,
        }
    }

    #[test]
    fn ticks_convert_to_unix_ms() {
        // 2026-01-01T00:00:00Z
        let unix_ms = 1_767_225_600_000i64;
        let ticks = (unix_ms + 11_644_473_600_000) * 10_000;
        assert_eq!(winrt_ticks_to_unix_ms(ticks), unix_ms);
    }

    #[test]
    fn toast_text_splits_into_title_and_body() {
        let lines = vec![
            "Ogechi".to_string(),
            "  ".to_string(),
            "are you coming?".to_string(),
            "see you".to_string(),
        ];
        assert_eq!(
            split_toast_text(&lines),
            ("Ogechi".to_string(), "are you coming?\nsee you".to_string())
        );
        assert_eq!(split_toast_text(&[]), (String::new(), String::new()));
    }

    #[test]
    fn newest_first_sorts_and_limits() {
        let sorted = newest_first(vec![item(1, 10), item(2, 30), item(3, 20)], 2);
        assert_eq!(
            sorted.iter().map(|i| i.id).collect::<Vec<_>>(),
            vec![2, 3]
        );
    }
}
