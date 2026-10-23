//! Dock layout settings that change how much screen the dock reserves:
//! its own size, floating off the edge, and the tablet pill.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager};

/// Set while the dock is folded into its tablet pill.
pub static DOCK_TABLET_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Settings that change the reserved strip, so saving one re-registers the AppBar.
pub const LAYOUT_KEYS: [&str; 3] = ["bloom-scale", "bloom-dock-size", "bloom-dock-style"];

/// Size multiplier for `bloom-dock-size`. Keep in step with dockLayout.ts.
pub fn size_factor(size: Option<&str>) -> f64 {
    match size {
        Some("small") => 0.85,
        Some("large") => 1.2,
        _ => 1.0,
    }
}

/// Gap under a floating dock, in logical pixels. Keep in step with dockLayout.ts.
pub const FLOAT_GAP: f64 = 12.0;

/// Height of the strip a fixed dock reserves, in logical pixels before
/// `bloom-scale`. The tablet pill reserves only a sliver so apps get the screen.
pub fn reserved_logical(size: Option<&str>, style: Option<&str>, tablet: bool) -> f64 {
    if tablet {
        return 14.0;
    }
    let gap = if style == Some("floating") { FLOAT_GAP } else { 0.0 };
    56.0 * size_factor(size) + gap
}

pub fn current_reserved_logical(app: &AppHandle) -> f64 {
    let size = crate::utils::get_setting_str(app, "bloom-dock-size");
    let style = crate::utils::get_setting_str(app, "bloom-dock-style");
    reserved_logical(
        size.as_deref(),
        style.as_deref(),
        DOCK_TABLET_ACTIVE.load(Ordering::Relaxed),
    )
}

#[derive(serde::Serialize)]
pub struct TabletPosture {
    /// The PC has a built-in touch screen.
    pub touch: bool,
    /// Windows reports slate mode: the keyboard is folded back or detached.
    pub slate: bool,
}

/// Whether a 2-in-1 is being used as a tablet. Windows reports slate mode
/// through `SM_CONVERTIBLESLATEMODE` (0 means slate); only PCs with a built-in
/// touch screen count, since some desktops report 0 as well.
#[tauri::command]
pub fn get_tablet_posture() -> TabletPosture {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, NID_INTEGRATED_TOUCH, SM_CONVERTIBLESLATEMODE, SM_DIGITIZER,
    };
    unsafe {
        let touch = (GetSystemMetrics(SM_DIGITIZER) as u32 & NID_INTEGRATED_TOUCH) != 0;
        let slate = touch && GetSystemMetrics(SM_CONVERTIBLESLATEMODE) == 0;
        TabletPosture { touch, slate }
    }
}

/// The dock tells the backend when it folds into or out of the tablet pill,
/// so a fixed dock stops holding a full-height strip while it's a pill.
#[tauri::command]
pub fn set_dock_tablet(app: AppHandle, active: bool) {
    if DOCK_TABLET_ACTIVE.swap(active, Ordering::Relaxed) == active {
        return;
    }
    let fixed = crate::utils::get_setting_str(&app, "bloom-dock-mode").as_deref() == Some("fixed");
    if fixed {
        if let Some(dock) = app.get_webview_window("dock") {
            crate::services::register_dock_appbar(dock);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reserved_height_follows_size_style_and_tablet() {
        assert_eq!(reserved_logical(None, None, false), 56.0);
        assert_eq!(reserved_logical(Some("medium"), Some("attached"), false), 56.0);
        assert_eq!(reserved_logical(Some("large"), None, false), 56.0 * 1.2);
        assert_eq!(reserved_logical(Some("small"), Some("floating"), false), 56.0 * 0.85 + 12.0);
        assert_eq!(reserved_logical(Some("large"), Some("floating"), true), 14.0);
    }
}
