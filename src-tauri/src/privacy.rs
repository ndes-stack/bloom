//! Whether any app is using the camera or microphone right now, for the
//! notch's privacy dot (Settings > Appearance > Live Activities).
//!
//! Windows records each app's use of them under
//! HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\<capability>,
//! one subkey per Store app plus `NonPackaged\<exe path>` for desktop apps.
//! An app whose `LastUsedTimeStop` is 0 (with a start time set) is using it
//! right now.

use serde::Serialize;

#[derive(Serialize, Default, Clone, Copy)]
pub struct DeviceUse {
    camera: bool,
    microphone: bool,
}

/// In use: started at some point and not stopped since.
fn running(start: Option<u64>, stop: Option<u64>) -> bool {
    matches!((start, stop), (Some(s), Some(0)) if s > 0)
}

#[cfg(windows)]
mod imp {
    use windows::core::{HSTRING, PWSTR};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER,
        KEY_READ,
    };

    /// Closes the key when dropped.
    struct Key(HKEY);

    impl Drop for Key {
        fn drop(&mut self) {
            unsafe {
                let _ = RegCloseKey(self.0);
            }
        }
    }

    fn open(parent: HKEY, path: &str) -> Option<Key> {
        let mut key = HKEY::default();
        let path = HSTRING::from(path);
        unsafe { RegOpenKeyExW(parent, &path, Some(0), KEY_READ, &mut key) }
            .is_ok()
            .then_some(Key(key))
    }

    fn subkeys(key: &Key) -> Vec<String> {
        let mut names = Vec::new();
        for index in 0..4096u32 {
            let mut buf = [0u16; 512];
            let mut len = buf.len() as u32;
            let result = unsafe {
                RegEnumKeyExW(
                    key.0,
                    index,
                    Some(PWSTR(buf.as_mut_ptr())),
                    &mut len,
                    None,
                    None,
                    None,
                    None,
                )
            };
            if !result.is_ok() {
                break;
            }
            names.push(String::from_utf16_lossy(&buf[..len as usize]));
        }
        names
    }

    fn qword(key: &Key, name: &str) -> Option<u64> {
        let mut value: u64 = 0;
        let mut size = std::mem::size_of::<u64>() as u32;
        let name = HSTRING::from(name);
        let result = unsafe {
            RegQueryValueExW(
                key.0,
                &name,
                None,
                None,
                Some(&mut value as *mut u64 as *mut u8),
                Some(&mut size),
            )
        };
        result.is_ok().then_some(value)
    }

    fn in_use(key: &Key) -> bool {
        super::running(qword(key, "LastUsedTimeStart"), qword(key, "LastUsedTimeStop"))
    }

    pub fn capability_in_use(capability: &str) -> bool {
        let base = format!(
            "Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\{capability}"
        );
        let Some(root) = open(HKEY_CURRENT_USER, &base) else {
            return false;
        };
        for name in subkeys(&root) {
            let Some(app) = open(root.0, &name) else {
                continue;
            };
            if name == "NonPackaged" {
                for exe in subkeys(&app) {
                    if open(app.0, &exe).is_some_and(|k| in_use(&k)) {
                        return true;
                    }
                }
            } else if in_use(&app) {
                return true;
            }
        }
        false
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn capability_in_use(_capability: &str) -> bool {
        false
    }
}

/// Camera and microphone use right now. Polled every few seconds by the notch.
#[tauri::command]
pub async fn get_device_use() -> DeviceUse {
    tauri::async_runtime::spawn_blocking(|| DeviceUse {
        camera: imp::capability_in_use("webcam"),
        microphone: imp::capability_in_use("microphone"),
    })
    .await
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::running;

    #[test]
    fn running_needs_a_start_and_no_stop() {
        assert!(running(Some(133_000_000_000_000_000), Some(0)));
        assert!(!running(Some(133_000_000_000_000_000), Some(133_000_000_100_000_000)));
        assert!(!running(Some(0), Some(0)));
        assert!(!running(None, Some(0)));
        assert!(!running(Some(5), None));
    }
}
