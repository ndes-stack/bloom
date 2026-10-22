//! Google Calendar (or any iCal) feed for the notch calendar.
//!
//! The user pastes their calendar's "Secret address in iCal format" into
//! Settings. Google's iCal endpoint doesn't send CORS headers, so the webview
//! can't fetch it directly; the backend does it instead and hands the raw
//! `.ics` text to the frontend, which parses and lays out the events.
//!
//! The command reads the link from the settings cache rather than taking it
//! as an argument, so a script running in a webview can't turn this into a
//! general-purpose "fetch any URL" primitive.

use std::time::Duration;

pub const CALENDAR_URL_KEY: &str = "bloom-calendar-ics-url";

/// Larger than any real personal calendar; stops a bad link from eating memory.
const MAX_ICS_BYTES: usize = 5 * 1024 * 1024;
const FETCH_TIMEOUT: Duration = Duration::from_secs(20);

/// Accepts `https://` links and Google's `webcal://` form (rewritten to https).
/// Anything else, including plain `http://`, is rejected.
pub fn normalize_ics_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    let candidate = match trimmed.get(..9) {
        Some(prefix) if prefix.eq_ignore_ascii_case("webcal://") => {
            format!("https://{}", &trimmed[9..])
        }
        _ => trimmed.to_string(),
    };
    let parsed = reqwest::Url::parse(&candidate)
        .map_err(|_| "That calendar link isn't a valid web address.".to_string())?;
    if parsed.scheme() != "https" {
        return Err("The calendar link must start with https://".to_string());
    }
    if parsed.host_str().is_none_or(|h| h.is_empty()) {
        return Err("That calendar link isn't a valid web address.".to_string());
    }
    Ok(parsed.to_string())
}

/// True if the body looks like an iCalendar file (ignoring a UTF-8 BOM).
pub fn looks_like_ics(text: &str) -> bool {
    text.trim_start_matches('\u{feff}')
        .trim_start()
        .get(..15)
        .is_some_and(|s| s.eq_ignore_ascii_case("BEGIN:VCALENDAR"))
}

/// Downloads an iCal feed. Error messages never include the URL, because
/// the secret link is effectively a password.
pub async fn fetch_ics(url: &str) -> Result<String, String> {
    // reqwest is built without a bundled crypto provider (shared with the
    // updater plugin), so make sure one is installed. Safe to call repeatedly.
    let _ = rustls::crypto::ring::default_provider().install_default();

    let client = reqwest::Client::builder()
        .timeout(FETCH_TIMEOUT)
        .user_agent(concat!("Bloom/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("Couldn't start the calendar download: {}", e.without_url()))?;

    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach the calendar: {}", e.without_url()))?;

    let status = response.status();
    if !status.is_success() {
        return Err(match status.as_u16() {
            401 | 403 | 404 => "Google rejected the calendar link. Copy the \"Secret address in iCal format\" again; it may have been reset.".to_string(),
            code => format!("The calendar server answered with an error (HTTP {code})."),
        });
    }

    let mut body: Vec<u8> = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("The calendar download was interrupted: {}", e.without_url()))?
    {
        if body.len() + chunk.len() > MAX_ICS_BYTES {
            return Err("That calendar is too large to load (over 5 MB).".to_string());
        }
        body.extend_from_slice(&chunk);
    }

    let text = String::from_utf8_lossy(&body).into_owned();
    if !looks_like_ics(&text) {
        return Err(
            "That link didn't return a calendar. Use the \"Secret address in iCal format\" link from Google Calendar settings."
                .to_string(),
        );
    }
    Ok(text)
}

/// Returns the user's calendar feed as raw iCal text, or `None` when no
/// calendar link is set.
#[tauri::command]
pub async fn fetch_calendar_ics(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let Some(raw) = crate::utils::get_setting_str(&app, CALENDAR_URL_KEY)
        .filter(|s| !s.trim().is_empty())
    else {
        return Ok(None);
    };
    let url = normalize_ics_url(&raw)?;
    fetch_ics(&url).await.map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_https_links() {
        let url = "https://calendar.google.com/calendar/ical/abc%40group/private-123/basic.ics";
        assert_eq!(normalize_ics_url(url).unwrap(), url);
        assert_eq!(normalize_ics_url(&format!("  {url}\n")).unwrap(), url);
    }

    #[test]
    fn rewrites_webcal_links() {
        assert_eq!(
            normalize_ics_url("webcal://example.com/cal.ics").unwrap(),
            "https://example.com/cal.ics"
        );
        assert_eq!(
            normalize_ics_url("WEBCAL://example.com/cal.ics").unwrap(),
            "https://example.com/cal.ics"
        );
    }

    #[test]
    fn rejects_other_schemes_and_garbage() {
        assert!(normalize_ics_url("http://example.com/cal.ics").is_err());
        assert!(normalize_ics_url("file:///C:/secret.txt").is_err());
        assert!(normalize_ics_url("not a url").is_err());
        assert!(normalize_ics_url("").is_err());
    }

    #[test]
    fn recognises_ics_bodies() {
        assert!(looks_like_ics("BEGIN:VCALENDAR\r\nVERSION:2.0"));
        assert!(looks_like_ics("\u{feff}\r\nbegin:vcalendar"));
        assert!(!looks_like_ics("<!DOCTYPE html><html>"));
        assert!(!looks_like_ics(""));
    }
}
