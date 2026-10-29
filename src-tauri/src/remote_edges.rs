//! Edge triggers on other displays. Bloom lives on the main display, but
//! resting the mouse against the top edge of another display opens the notch,
//! and against its bottom edge shows the dock, so neither needs a trip across
//! the desk first (`bloom-notch-remote-edge`, `bloom-dock-remote-edge`).
//!
//! A small poll rather than more work in the mouse hook: the hook has to
//! answer within Windows' timeout, and this only matters with two or more
//! displays.

use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Edge {
    Top,
    Bottom,
}

/// How long the cursor rests on an edge before it counts, so passing over a
/// shared edge into a display above or below never triggers anything.
const DWELL: Duration = Duration::from_millis(300);
const POLL: Duration = Duration::from_millis(40);

/// The edge of `monitor` (left, top, right, bottom; right and bottom
/// exclusive) the cursor at (x, y) is pressed against, if any.
pub fn edge_at(x: i32, y: i32, monitor: (i32, i32, i32, i32)) -> Option<Edge> {
    let (left, top, right, bottom) = monitor;
    if x < left || x >= right || y < top || y >= bottom {
        return None;
    }
    if y <= top {
        Some(Edge::Top)
    } else if y >= bottom - 1 {
        Some(Edge::Bottom)
    } else {
        None
    }
}

/// Keeps track of the edge being rested on, and says when that changes once
/// the dwell has passed (or straight away when the cursor leaves).
#[derive(Default)]
pub struct EdgeDwell {
    pending: Option<(Edge, Instant)>,
    active: Option<Edge>,
}

impl EdgeDwell {
    /// The edge to report as newly active or released: `Some((edge, true))`
    /// when `edge` has been rested on for the dwell, `Some((edge, false))`
    /// when the active edge was let go.
    pub fn update(&mut self, edge: Option<Edge>, now: Instant) -> Option<(Edge, bool)> {
        if let Some(active) = self.active {
            if edge != Some(active) {
                self.active = None;
                self.pending = edge.map(|e| (e, now));
                return Some((active, false));
            }
            return None;
        }
        match (edge, self.pending) {
            (None, _) => {
                self.pending = None;
                None
            }
            (Some(e), Some((p, since))) if e == p => {
                if now.duration_since(since) >= DWELL {
                    self.active = Some(e);
                    self.pending = None;
                    Some((e, true))
                } else {
                    None
                }
            }
            (Some(e), _) => {
                self.pending = Some((e, now));
                None
            }
        }
    }
}

/// On unless the setting says otherwise (stored as "false" or false).
fn setting_on(key: &str) -> bool {
    crate::state::SETTINGS_CACHE.get().is_none_or(|cache| {
        cache.lock().map_or(true, |guard| match guard.get(key) {
            Some(serde_json::Value::Bool(b)) => *b,
            Some(serde_json::Value::String(s)) => s != "false",
            _ => true,
        })
    })
}

/// The cursor's edge on a display other than the main one, unless the window
/// in front fills that display (a full-screen video or game there).
fn cursor_edge_off_primary() -> Option<Edge> {
    use windows::Win32::Foundation::{POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONULL,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetCursorPos, GetForegroundWindow, GetWindowRect};
    unsafe {
        let mut pt = POINT::default();
        GetCursorPos(&mut pt).ok()?;
        let monitor = MonitorFromPoint(pt, MONITOR_DEFAULTTONULL);
        if monitor.is_invalid() {
            return None;
        }
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() || info.dwFlags & 1 != 0 {
            return None;
        }
        let m = info.rcMonitor;
        let edge = edge_at(pt.x, pt.y, (m.left, m.top, m.right, m.bottom))?;
        let fg = GetForegroundWindow();
        if !fg.is_invalid() && MonitorFromWindow(fg, MONITOR_DEFAULTTONULL) == monitor {
            let mut r = RECT::default();
            if GetWindowRect(fg, &mut r).is_ok()
                && r.left <= m.left
                && r.top <= m.top
                && r.right >= m.right
                && r.bottom >= m.bottom
            {
                return None;
            }
        }
        Some(edge)
    }
}

pub fn setup(app: AppHandle) {
    std::thread::Builder::new()
        .name("bloom-remote-edges".into())
        .spawn(move || {
            use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CMONITORS};
            let mut dwell = EdgeDwell::default();
            let mut settings_at = Instant::now() - Duration::from_secs(1);
            let (mut notch_on, mut dock_on) = (true, true);
            while !crate::state::SHUTTING_DOWN.load(Ordering::Relaxed) {
                std::thread::sleep(POLL);
                if settings_at.elapsed() >= Duration::from_millis(500) {
                    settings_at = Instant::now();
                    notch_on = setting_on("bloom-notch-remote-edge");
                    dock_on = setting_on("bloom-dock-remote-edge") && crate::utils::dock_enabled();
                }
                let several = unsafe { GetSystemMetrics(SM_CMONITORS) } > 1;
                let edge = if several && (notch_on || dock_on) {
                    cursor_edge_off_primary().filter(|e| match e {
                        Edge::Top => notch_on,
                        Edge::Bottom => dock_on,
                    })
                } else {
                    None
                };
                if let Some((edge, active)) = dwell.update(edge, Instant::now()) {
                    let (window, event) = match edge {
                        Edge::Top => ("main", "notch-remote-edge"),
                        Edge::Bottom => ("dock", "dock-remote-edge"),
                    };
                    let _ = app.emit_to(window, event, active);
                }
            }
        })
        .ok();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_edge_the_cursor_rests_on() {
        let m = (1920, 0, 3840, 1080);
        assert_eq!(edge_at(2500, 0, m), Some(Edge::Top));
        assert_eq!(edge_at(2500, 1079, m), Some(Edge::Bottom));
        assert_eq!(edge_at(2500, 500, m), None);
        assert_eq!(edge_at(100, 0, m), None);
    }

    #[test]
    fn an_edge_counts_only_after_the_dwell() {
        let mut d = EdgeDwell::default();
        let t = Instant::now();
        assert_eq!(d.update(Some(Edge::Top), t), None);
        assert_eq!(d.update(Some(Edge::Top), t + Duration::from_millis(100)), None);
        assert_eq!(d.update(Some(Edge::Top), t + DWELL), Some((Edge::Top, true)));
        assert_eq!(d.update(Some(Edge::Top), t + DWELL * 2), None);
        assert_eq!(d.update(None, t + DWELL * 3), Some((Edge::Top, false)));
        // Passing over an edge without resting never triggers.
        assert_eq!(d.update(Some(Edge::Bottom), t + DWELL * 4), None);
        assert_eq!(d.update(None, t + DWELL * 4 + Duration::from_millis(50)), None);
    }
}
