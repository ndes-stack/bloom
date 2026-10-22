//! Screenshot of what is behind the notch window, for the blurred notch
//! materials (Settings > Appearance > Notch Material).
//!
//! A webview can only blur its own pixels, so the notch can't use CSS
//! `backdrop-filter` on the desktop. Instead the frontend asks for a small
//! screenshot of the area under the notch window and blurs it itself. The
//! notch is kept out of the shot by briefly excluding its window from screen
//! capture (Windows 10 2004 and later); it stays visible on the monitor the
//! whole time and is restored to normal straight after, so screenshots and
//! screen sharing still include Bloom.

use tauri::WebviewWindow;

/// The screenshot is this many times smaller than the window on each side.
/// It is blurred heavily anyway, and a small image is quick to send.
const DOWNSCALE: i32 = 3;

/// A 32-bit top-down BMP file from BGRA pixels. Alpha is forced opaque: a
/// screen grab has no meaningful alpha and some decoders would honour zeros.
fn bmp_from_bgra(width: u32, height: u32, mut pixels: Vec<u8>) -> Vec<u8> {
    for px in pixels.chunks_exact_mut(4) {
        px[3] = 255;
    }
    let header_len: u32 = 14 + 40;
    let file_len = header_len + pixels.len() as u32;
    let mut out = Vec::with_capacity(file_len as usize);
    // BITMAPFILEHEADER
    out.extend_from_slice(b"BM");
    out.extend_from_slice(&file_len.to_le_bytes());
    out.extend_from_slice(&0u32.to_le_bytes());
    out.extend_from_slice(&header_len.to_le_bytes());
    // BITMAPINFOHEADER, negative height = rows top to bottom
    out.extend_from_slice(&40u32.to_le_bytes());
    out.extend_from_slice(&(width as i32).to_le_bytes());
    out.extend_from_slice(&(-(height as i32)).to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&32u16.to_le_bytes());
    out.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
    out.extend_from_slice(&(pixels.len() as u32).to_le_bytes());
    out.extend_from_slice(&2835i32.to_le_bytes());
    out.extend_from_slice(&2835i32.to_le_bytes());
    out.extend_from_slice(&0u32.to_le_bytes());
    out.extend_from_slice(&0u32.to_le_bytes());
    out.extend_from_slice(&pixels);
    out
}

#[cfg(windows)]
fn capture_behind(hwnd_raw: isize) -> Result<Vec<u8>, String> {
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::Graphics::Dwm::DwmFlush;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
        ReleaseDC, SelectObject, SetBrushOrgEx, SetStretchBltMode, StretchBlt, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, CAPTUREBLT, DIB_RGB_COLORS, HALFTONE, ROP_CODE, SRCCOPY,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowRect, SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
    };

    let hwnd = HWND(hwnd_raw as *mut _);
    unsafe {
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).map_err(|e| e.to_string())?;
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 || width > 16384 || height > 8192 {
            return Err("notch window has no usable size".into());
        }
        let out_w = (width / DOWNSCALE).max(1);
        let out_h = (height / DOWNSCALE).max(1);

        // Leave the notch out of the shot. DWM applies this on its next
        // frame, so wait for two compositions before grabbing the screen.
        SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
            .map_err(|e| format!("can't exclude the notch from capture: {e}"))?;
        if DwmFlush().is_err() || DwmFlush().is_err() {
            std::thread::sleep(std::time::Duration::from_millis(40));
        }

        let screen = GetDC(None);
        let mem = CreateCompatibleDC(Some(screen));
        let bitmap = CreateCompatibleBitmap(screen, out_w, out_h);
        let old = SelectObject(mem, bitmap.into());
        SetStretchBltMode(mem, HALFTONE);
        let _ = SetBrushOrgEx(mem, 0, 0, None);
        let copied = StretchBlt(
            mem,
            0,
            0,
            out_w,
            out_h,
            Some(screen),
            rect.left,
            rect.top,
            width,
            height,
            ROP_CODE(SRCCOPY.0 | CAPTUREBLT.0),
        )
        .as_bool();

        // Back to normal straight away, whatever happened above.
        let _ = SetWindowDisplayAffinity(hwnd, WDA_NONE);

        let mut pixels = vec![0u8; (out_w * out_h * 4) as usize];
        let mut lines = 0;
        if copied {
            let mut info = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: out_w,
                    biHeight: -out_h,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            lines = GetDIBits(
                mem,
                bitmap,
                0,
                out_h as u32,
                Some(pixels.as_mut_ptr() as *mut _),
                &mut info,
                DIB_RGB_COLORS,
            );
        }

        let _ = SelectObject(mem, old);
        let _ = DeleteObject(bitmap.into());
        let _ = DeleteDC(mem);
        let _ = ReleaseDC(None, screen);

        if !copied || lines == 0 {
            return Err("screen capture failed".into());
        }
        Ok(bmp_from_bgra(out_w as u32, out_h as u32, pixels))
    }
}

#[cfg(not(windows))]
fn capture_behind(_hwnd_raw: isize) -> Result<Vec<u8>, String> {
    Err("only supported on Windows".into())
}

/// A downscaled BMP of the screen area under the calling window, with the
/// window itself left out. Errors when the system can't leave it out.
#[tauri::command]
pub async fn capture_notch_backdrop(window: WebviewWindow) -> Result<tauri::ipc::Response, String> {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
    let bytes = tauri::async_runtime::spawn_blocking(move || capture_behind(hwnd))
        .await
        .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bmp_header_and_opaque_pixels() {
        let bmp = bmp_from_bgra(2, 1, vec![1, 2, 3, 0, 4, 5, 6, 0]);
        assert_eq!(&bmp[0..2], b"BM");
        assert_eq!(u32::from_le_bytes(bmp[2..6].try_into().unwrap()), 54 + 8);
        assert_eq!(u32::from_le_bytes(bmp[10..14].try_into().unwrap()), 54);
        assert_eq!(i32::from_le_bytes(bmp[18..22].try_into().unwrap()), 2);
        assert_eq!(i32::from_le_bytes(bmp[22..26].try_into().unwrap()), -1);
        assert_eq!(u16::from_le_bytes(bmp[28..30].try_into().unwrap()), 32);
        assert_eq!(&bmp[54..], &[1, 2, 3, 255, 4, 5, 6, 255]);
    }
}
