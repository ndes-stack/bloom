# Bloom Settings Reference

All settings are stored in `settings.json` in the app config directory (`%APPDATA%/bloom/`). The file is a flat JSON object with `bloom-` prefixed keys. Bloom watches this file for external changes and applies them in real-time.

## Quick Start

Edit `settings.json` with any text editor while Bloom is running. Changes are applied immediately — no restart required.

```json
{
	"bloom-dock-enabled": "true",
	"bloom-dock-mode": "smart",
	"bloom-theme-mode": "dark",
	"bloom-scale": "1.0"
}
```

## Settings Keys

### Dock

| Key                                | Type                             | Default       | Description                                                                                                                                                                      |
| ---------------------------------- | -------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bloom-dock-enabled`               | `"true"` / `"false"`             | `"true"`      | Show or hide the Bloom Dock (taskbar replacement).                                                                                                                               |
| `bloom-dock-mode`                  | `"fixed"` / `"smart"` / `"peek"` | `"smart"`     | Dock visibility behavior. **fixed** = always visible as AppBar. **smart** = auto-hide when overlapped by fullscreen apps. **peek** = hidden until cursor approaches bottom edge. |
| `bloom-dock-edge-delay`            | milliseconds `"0"`–`"2000"`      | `"200"`       | In smart/peek mode, how long the cursor must rest against the bottom screen edge before the dock appears. `"0"` reveals instantly.                                               |
| `bloom-dock-preview-enabled`       | `"true"` / `"false"`             | `"true"`      | Show window thumbnail previews when hovering dock icons.                                                                                                                         |
| `bloom-dock-icon-only`             | `"true"` / `"false"`             | `"false"`     | Minimal icon-only style (no background/padding around icons).                                                                                                                    |
| `bloom-dock-separator-enabled`     | `"true"` / `"false"`             | `"true"`      | Show a divider between pinned and unpinned dock apps when unpinned apps are present. Unpinned apps remain on the right when disabled.                                            |
| `bloom-start-icon`                 | icon key / `custom:<data URI>`   | `"default"`   | Start button icon: `default`, `bloom-colorful`, `bloom-golden`, `bloom-biscuit`, `windows`, or `custom:` followed by an uploaded image's data URI.                               |
| `bloom-dock-task-view`             | `"true"` / `"false"`             | `"false"`     | Show a Task View button beside Start that opens Task View, like the taskbar's. Right-click it to hide it again.                                                                  |
| `bloom-dock-tray`                  | `"true"` / `"false"`             | `"true"`      | Show the tray end of the dock: one button for Wi-Fi, sound and battery that opens Bloom's quick settings, the keyboard language, and a clock that opens notifications and the calendar. |
| `bloom-dock-material-link`         | `"true"` / `"false"`             | `"true"`      | Match the notch: the dock bar, its tray panels and Start use the notch's material, blur and tint. Off, they use the three `bloom-dock-*` material keys below. |
| `bloom-dock-material`              | `"solid"` / `"frosted"` / `"glass"` / `"custom"` | `"solid"` | The dock's own material while the link is off. Same looks as `bloom-notch-material`, blurring what is behind the dock. |
| `bloom-dock-blur`                  | integer string                   | `"28"`        | Blur radius in px for the dock's `custom` material (8 to 60). |
| `bloom-dock-tint`                  | integer string                   | `"55"`        | Tint opacity in percent for the dock's `custom` material (10 to 100). |
| `bloom-dock-style`                 | `"attached"` / `"floating"`      | `"attached"`  | Attached to the bottom edge, or floating 12px above it with round ends. A fixed dock reserves the gap too. |
| `bloom-dock-size`                  | `"small"` / `"medium"` / `"large"` | `"medium"`  | The dock's own size on top of `bloom-scale` (0.85x, 1x, 1.2x). Ctrl+drag on the dock changes it. |
| `bloom-dock-tablet`                | `"auto"` / `"always"` / `"off"`  | `"auto"`      | Tablet pill: fold the dock into a thin pill when Windows reports slate mode (keyboard folded back or detached on a touch 2-in-1), always, or never. |
| `bloom-dock-pill-glance`           | `"true"` / `"false"`             | `"false"`     | The tablet pill shows the time, battery and a notification dot instead of a plain bar. |
| `bloom-start-menu`                 | `"bloom"` / `"windows"`          | `"bloom"`     | What the dock's Start button opens: Bloom's Start menu (search, pinned apps, your current class, recent files, All apps, power) or the Windows one. |
| `bloom-start-win-key`              | `"true"` / `"false"`             | `"true"`      | With `bloom-start-menu` on Bloom, a lone tap of the Windows key opens Bloom's Start instead of Windows'. Win+ shortcuts are unaffected. Needs the dock to be replacing the taskbar. |
| `bloom-start-pins`                 | JSON array of `{ "name", "path" }` | unset       | Apps pinned to Bloom's Start, in order. Unset means the dock's pinned apps. Right-click an app in Start to pin or unpin it. |
| `bloom-dock-adaptive`              | `"true"` / `"false"`             | `"false"`     | Fixed dock only. Stretch the dock to full width like a traditional taskbar while a window is maximized, and contract back when it's restored.                                    |
| `bloom-dock-win-number-enabled`    | `"true"` / `"false"`             | `"true"`      | When the taskbar is replaced, Win+1 through Win+9 activate the matching pinned dock app (focus/minimize if running, launch otherwise) instead of the native taskbar slots.       |
| `bloom-dock-extras-position`       | `"off"` / `"left"` / `"right"`   | `"off"`       | Show a dock extras section with drives, folders and the Recycle Bin beside the app icons, on the left or right side of the dock.                                                 |
| `bloom-dock-extras-drives`         | `"true"` / `"false"`             | `"true"`      | Show fixed, removable (with media) and connected mapped network drives in the dock extras. Empty card readers and unloaded discs are hidden.                                     |
| `bloom-dock-extras-hidden-drives`  | comma-separated letters          | `""`          | Drives left out of the dock extras, e.g. `"D,E"`. Drives not listed appear, including newly connected ones. Right-clicking a drive and choosing Remove from Dock adds it here. |
| `bloom-dock-extras-recycle-bin`    | `"true"` / `"false"`             | `"true"`      | Show the Recycle Bin in the dock extras. The icon reflects whether the bin holds anything.                                                                                       |
| `bloom-dock-extras-folders`        | comma-separated ids              | `"downloads"` | Known folders in the dock extras: any of `desktop`, `downloads`, `documents`, `pictures`, `music`, `videos`, or `"none"` for no folders.                                         |
| `bloom-dock-extras-custom-folders` | JSON array                       | `"[]"`        | User-added folders, e.g. `[{"name":"Projects","path":"D:\\Projects"}]`. Folders that no longer exist are skipped until they return.                                              |

### Notch

| Key                      | Type                             | Default   | Description                                                                                                                    |
| ------------------------ | -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `bloom-notch-mode`       | `"fixed"` / `"smart"` / `"peek"` | `"fixed"` | Notch (top bar) visibility behavior. Same modes as dock. **peek** shows the notch briefly on media events and notifications.   |
| `bloom-notch-edge-delay` | milliseconds `"0"`–`"2000"`      | `"200"`   | In smart/peek mode, how long the cursor must rest against the top screen edge before the notch peeks. `"0"` reveals instantly. |
| `bloom-scroll-speed`     | `"1"`–`"5"`                       | `"3"`     | How fast scrolling over the notch flips between panels. The first flip is instant; holding the scroll keeps flipping, at most once per 900 / 650 / 450 / 320 / 220 ms for 1–5. Touchpad momentum is ignored. |
| `bloom-page-switch-grace` | milliseconds `"0"`–`"2000"`     | `"800"`   | After switching notch pages (which can shrink the notch out from under the pointer), how long it stays open while the pointer is outside. Coming back within this time keeps it open. `"0"` turns it off. |
| `bloom-notch-panel-order` | JSON array of panel ids          | `["calendar","timer","launcher","command-center"]` | Order scrolling and the panel arrows move through the notch pages. Unknown ids are ignored and missing pages are appended. |
| `bloom-launcher-items`   | JSON array                        | `[]`      | Quick Launcher pins, in order: `{"id","kind":"app"|"folder"|"file"|"url","name","target"}`. |
| `bloom-launcher-shortcut` | `"true"` / `"false"`             | `"true"`  | A keyboard shortcut (see `bloom-launcher-hotkey`) opens the notch's Quick Launcher with the search box ready. It stays open until Esc, the shortcut again or a click outside Bloom. |
| `bloom-launcher-hotkey`  | shortcut string                   | `"Alt+Space"` | The Quick Launcher's shortcut: any of `Ctrl`, `Alt`, `Shift`, `Win`, then one key (`A`-`Z`, `0`-`9`, `F1`-`F24`, `Space`, `Enter`, `Tab`, `Backquote` and other `KeyboardEvent.code` names), joined by `+`. Needs a modifier unless the key is F1-F24. Recorded in Settings > Notch. |

### Weather

| Key                              | Type                         | Default     | Description                                                                        |
| -------------------------------- | ---------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `bloom-weather-enabled`          | `"true"` / `"false"`         | `"true"`    | Show weather widget in the notch status bar.                                       |
| `bloom-weather-city`             | string                       | `""`        | Manually set city name for weather. Empty string = auto-detect via IP geolocation. |
| `bloom-weather-lat`              | number string                | (auto)      | Latitude coordinate for weather. Set automatically when a city is selected.        |
| `bloom-weather-lon`              | number string                | (auto)      | Longitude coordinate for weather. Set automatically when a city is selected.       |
| `bloom-weather-cached-temp`      | number string                | (none)      | Cached temperature value shown before next API fetch.                              |
| `bloom-weather-cached-condition` | string                       | (none)      | Cached weather condition text (e.g. "Partly Cloudy").                              |
| `bloom-temp-unit`                | `"celsius"` / `"fahrenheit"` | `"celsius"` | Temperature display unit.                                                          |

### Modules

| Key                         | Type                              | Default  | Description                                                                                              |
| --------------------------- | --------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `bloom-calendar-enabled`    | `"true"` / `"false"`              | `"true"` | Enable calendar/timer mode in the notch.                                                                 |
| `bloom-calendar-ics-url`   | https URL (or `webcal://`)        | unset    | Google Calendar "Secret address in iCal format" (any iCal feed works). Events appear as dots in the notch calendar with a hover popup. Treat it like a password. |
| `bloom-reminders-enabled`    | `"true"` / `"false"`                     | `"true"`    | Class reminders: before an event on the linked calendar starts, the closed notch stretches into a slim bar that says what's next. Settings > Notch > Class Reminders also has a Preview button. |
| `bloom-reminder-lead`        | `"5"` / `"10"` / `"15"` / `"30"`         | `"10"`      | Minutes before the start that the reminder appears. |
| `bloom-reminder-duration`    | `"8"` / `"15"` / `"30"` / `"0"`          | `"15"`      | Seconds the bar stays up; `0` keeps it until dismissed. Hovering keeps it up and shows Snooze 5 min, Open and Dismiss. |
| `bloom-reminder-width`       | `"compact"` / `"wide"`                   | `"wide"`    | Bar width: 440 or 600 px. Wide also shows the location. |
| `bloom-reminder-skip-allday` | `"true"` / `"false"`                     | `"true"`    | Don't remind for all-day events. |
| `bloom-reminder-sound`       | `"true"` / `"false"`                     | `"false"`   | Play the timer chime when a reminder appears. |
| `bloom-calendar-view`     | `"month"` / `"agenda"` / `"columns"` / `"grid"` | `"month"` | Notch calendar layout, picked with the buttons in the calendar header and remembered: month grid, week day-list, week columns, or week timetable. |
| `bloom-notch-command-center-enabled` | `"true"` / `"false"` | `"true"` | Show the Command Center panel in the notch. |
| `bloom-notch-devices-enabled` | `"true"` / `"false"` | `"false"` | Show the Connected devices panel in the notch. Settings keeps at least one of the panels (calendar, Command Center, Connected devices) on; if all are off, the notch shows Command Center. |
| `bloom-music-mode-enabled`  | `"true"` / `"false"`              | `"true"` | Enable interactive music media widget.                                                                   |
| `bloom-music-compact-notch` | `"true"` / `"false"`              | `"true"` | Show compact music display (visualizer + artwork) in collapsed notch.                                    |
| `bloom-notch-remember-panel` | `"true"` / `"false"` | `"true"` | Click opens the last-used panel when on; when off, click opens `bloom-notch-default-panel`. |
| `bloom-notch-default-panel` | `"calendar"` / `"timer"` / `"launcher"` / `"command-center"` / `"devices"` | `"calendar"` | Fixed panel opened on click when panel memory is off. If that panel is turned off, the first panel that is on opens instead. |
| `bloom-notch-last-panel`    | `"calendar"` / `"timer"` / `"launcher"` / `"command-center"` / `"devices"` | (unset)  | Last panel the notch was left on, saved by Bloom while panel memory is on. |
| `bloom-notch-click-to-open` | `"true"` / `"false"` | (legacy) | Old setting read only when `bloom-notch-remember-panel` is absent; `"false"` now selects fixed-panel behavior. |
| `bloom-device-looks` | JSON object, device name → `"headphones"` / `"round-buds"` / `"stem-buds"` / `"neckband"` / `"speaker"` for Bluetooth audio; `"headphones-wired"` / `"earbuds-usbc"` / `"earbuds-jack"` / `"speaker"` / `"microphone"` for wired and USB audio | (unset) | The drawing an audio device's connection popup uses, picked under "Looks like" in the notch's Connected devices panel (or, for Bluetooth, its Bluetooth view). Devices without a pick are guessed from their name and class. |

### Shelf

| Key                   | Type                 | Default   | Description                                                                                                    |
| --------------------- | -------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `bloom-shelf-persist` | `"true"` / `"false"` | `"false"` | Keep notch shelf items across restarts. Off = items are cleared when Bloom closes. Max 10 items, newest first. |

### Music Appearance

| Key                                | Type                      | Default     | Description                                                                                     |
| ---------------------------------- | ------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `bloom-media-layout`               | `"classic"` / `"compact"` | `"classic"` | Expanded player style. **classic** = large album art. **compact** = small thumbnail + controls. |
| `bloom-media-ambience-enabled`     | `"true"` / `"false"`      | `"true"`    | Colored ambient glow behind expanded album art.                                                 |
| `bloom-media-compact-glow-enabled` | `"true"` / `"false"`      | `"true"`    | Glow effect around the collapsed compact thumbnail.                                             |
| `bloom-media-visualizer-enabled`   | `"true"` / `"false"`      | `"true"`    | Audio visualizer bars in music mode. Also accepts `bloom-visualizer-enabled` (legacy alias).    |
| `bloom-media-album-art-enabled`    | `"true"` / `"false"`      | `"true"`    | Show album artwork in the notch music display.                                                  |

### Overlays

| Key                                | Type                 | Default  | Description                                                              |
| ---------------------------------- | -------------------- | -------- | ------------------------------------------------------------------------ |
| `bloom-volume-overlay-enabled`     | `"true"` / `"false"` | `"true"` | Show Bloom volume HUD when volume changes (replaces native Windows OSD). |
| `bloom-volume-edge-enabled`        | `"true"` / `"false"` | `"true"` | Trigger volume HUD by hovering the left screen edge.                     |
| `bloom-brightness-overlay-enabled` | `"true"` / `"false"` | `"true"` | Show Bloom brightness HUD when brightness changes.                       |
| `bloom-brightness-edge-enabled`    | `"true"` / `"false"` | `"true"` | Trigger brightness HUD by hovering the right screen edge.                |

### Appearance

| Key                      | Type                                             | Default     | Description                                                                                                                                                 |
| ------------------------ | ------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bloom-theme-mode`       | `"system"` / `"dark"` / `"light"` / `"custom"` / `"adaptive"` | `"dark"`    | Theme mode. **system** = switches between light and dark automatically to match the Windows app mode. **dark** = dark translucent. **light** = light translucent. **custom** = user-picked color. **adaptive** = follows Windows system accent color. |
| `bloom-theme-color`      | hex string                                       | `"#007aff"` | Custom theme color (used in `custom` and `adaptive` modes).                                                                                                 |
| `bloom-accent-color`     | hex string or unset               | unset       | Accent for "on" highlights in every window. Independent of `bloom-theme-mode`, so it works with `system` (Automatic). Unset follows the theme's accent. |
| `bloom-activity-style`  | `"island"` / `"glow"` / `"tags"` / `"rail"` / `"cards"` | `"island"` | How live activities (class reminders, deadlines, timer, music, charging, low battery) show. **island** = the notch stretches (shown as "Stretch"). **glow** = the notch stays small, swaps its text, and a coloured line glows along its bottom. **tags** = labels hang under the notch. **rail** = a thin readout strip slides out from both sides. **cards** = a light card drops out below, ongoing things show as chips. Events with due/deadline/submit in the title are reminded at least an hour early. |
| `bloom-timer-keep-visible` | `"true"` / `"false"`                          | `"true"`    | While a timer runs, and after it ends until "Time's up" is clicked, the notch stays on screen even in auto-hide (smart) and peek modes. |
| `bloom-privacy-dot`     | `"true"` / `"false"`                             | `"true"`    | A green dot beside the notch while an app uses the camera, orange for the microphone. Read from Windows' own record of camera and microphone use. |
| `bloom-notch-material`   | `"solid"` / `"frosted"` / `"glass"` / `"custom"` | `"solid"`   | Background of the open notch. **solid** = the theme colour. **frosted** (28px blur, 55% tint), **glass** (40px blur, 30% tint) and **custom** show a blurred screenshot of what is behind the notch under a see-through tint. The screenshot leaves the notch out by briefly excluding it from screen capture, which needs Windows 10 2004 or later; otherwise the notch stays solid. |
| `bloom-notch-blur`       | integer string                                   | `"28"`      | Blur radius in px for the `custom` material (8 to 60). |
| `bloom-notch-tint`       | integer string                                   | `"55"`      | Tint opacity in percent for the `custom` material (10 to 100). |
| `bloom-theme-opacity`    | float string                                     | `"0.80"`    | Background opacity (0.1 to 1.0).                                                                                                                            |
| `bloom-theme-saturation` | float string                                     | `"0.50"`    | Color saturation for custom/adaptive themes (0.0 to 1.0).                                                                                                   |
| `bloom-theme-brightness` | float string                                     | `"0.15"`    | Background brightness for custom/adaptive themes (0.0 to 1.0).                                                                                              |
| `bloom-corners-enabled`  | `"true"` / `"false"`                             | `"false"`   | Render rounded screen corner overlays on top edges.                                                                                                         |

### Status Widgets

| Key                    | Type        | Default                                    | Description                                                                                                 |
| ---------------------- | ----------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `bloom-status-widgets` | JSON string | `{"left":["weather"],"right":["battery"]}` | Widget layout in collapsed notch. Available: `"weather"`, `"battery"`, `"cpu"`, `"ram"`, `"disk"`, `"net"`. |

Example:

```json
{
	"bloom-status-widgets": "{\"left\":[\"cpu\",\"ram\"],\"right\":[\"battery\",\"net\"]}"
}
```

### System

| Key                            | Type                 | Default   | Description                                                                                          |
| ------------------------------ | -------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `bloom-scale`                  | float string         | `"1.0"`   | UI scale factor (0.8 to 1.3). Changing this re-registers AppBars to resize the reserved screen area. |
| `bloom-low-battery-threshold`  | integer string       | `"20"`    | Battery percentage that triggers the low-battery alert pulse (5 to 50, step 5).                      |
| `bloom-auto-update`            | `"true"` / `"false"` | `"false"` | Check for and download updates automatically on startup.                                             |
| `bloom-show-update-indicator`  | `"true"` / `"false"` | `"true"`  | Show a green dot on the notch when an update is available.                                           |
| `bloom-announcement-dismissed` | announcement id      | `""`      | ID of the last dismissed in-app announcement (published via `website/public/announcements.json`).    |
| `bloom-time-format-24h`        | `"true"` / `"false"` | `"false"` | Use 24-hour clock format in the notch. When `"false"`, displays 12-hour format with AM/PM.           |

### Internal (Do Not Edit Manually)

| Key                 | Type     | Description                                                                           |
| ------------------- | -------- | ------------------------------------------------------------------------------------- |
| `bloom-first-run`   | sentinel | Set to `"done"` after first launch. Triggers splash screen if absent.                 |
| `bloom-app-version` | string   | Last known app version. If it differs from current, splash screen is shown on update. |

## Event System

Bloom uses two Tauri events for settings synchronization:

### `settings-changed`

- **Emitted by:** `save_setting` command (frontend or backend)
- **Payload:** `{ "key": "bloom-...", "value": ... }`
- **Purpose:** Broadcasts changes made through the Bloom UI to all windows
- **Key format:** Bloom-prefixed keys as-is (e.g. `"bloom-dock-mode"`)

### `settings-external-changed`

- **Emitted by:** File watcher (detects external edits to `settings.json`)
- **Payload:** `{ "key": "bloom-...", "value": ... }` or `{ "key": "bloom-...", "value": null }` for removed keys
- **Purpose:** Broadcasts changes made by external editors (VS Code, notepad, scripts)
- **Key format:** Bloom-prefixed keys as-is
- **Behavior:** Also syncs values to `localStorage` for instant frontend reads

### Flow

```
External editor saves settings.json
    ↓
File watcher detects change (ReadDirectoryChangesW)
    ↓
Diffs against SETTINGS_CACHE
    ↓
Emits settings-external-changed for each changed/removed key
    ↓
useSettingsSync hook updates React state + localStorage
    ↓
useSettingsSync hook updates React state
    ↓
UI re-renders with new values
```

## Example: Changing Dock Mode via Script

```powershell
# PowerShell: switch dock to smart mode
$json = Get-Content "$env:APPDATA\bloom\settings.json" | ConvertFrom-Json
$json.'bloom-dock-mode' = 'smart'
$json | ConvertTo-Json | Set-Content "$env:APPDATA\bloom\settings.json"
```

```python
# Python: disable dock
import json, os
path = os.path.join(os.environ['APPDATA'], 'bloom', 'settings.json')
with open(path) as f: settings = json.load(f)
settings['bloom-dock-enabled'] = 'false'
with open(path, 'w') as f: json.dump(settings, f)
```

## Notes

- All boolean values are strings (`"true"` / `"false"`) for consistency with `localStorage`.
- The `useSettingsSync` hook auto-converts `"true"` / `"false"` strings to booleans.
- `auto-hide` mode values in `bloom-dock-mode` and `bloom-notch-mode` are legacy aliases for `smart` — they are mapped automatically.
- Changing `bloom-scale` triggers AppBar re-registration to adjust reserved screen space.
- Settings → General → Reset to Defaults removes every `bloom-` key from `settings.json` and `localStorage` (except the `bloom-first-run` / `bloom-app-version` lifecycle sentinels), then restarts Bloom. Pinned apps (`pinned_apps.json`) and uploaded icons (`custom_icons/`) are preserved.
- Theme changes (`bloom-theme-*`) are applied by reading all theme values from `localStorage` and calling `applyTheme()` — the theme system depends on all five theme keys being in sync.
