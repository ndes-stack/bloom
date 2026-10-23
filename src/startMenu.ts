// Bloom's Start menu: settings keys, Settings pages for search, and small
// helpers. No Tauri imports.

export const START_MENU_KEY = "bloom-start-menu";
export const START_PINS_KEY = "bloom-start-pins";

/** Which Start the dock's Start button opens. */
export type StartMenuKind = "bloom" | "windows";
export const parseStartMenu = (v: unknown): StartMenuKind => (v === "windows" ? "windows" : "bloom");

export interface StartPin {
	name: string;
	path: string;
}

/** The saved pins, or null when none were ever saved (use the defaults). */
export function parseStartPins(raw: unknown): StartPin[] | null {
	if (typeof raw !== "string" || !raw) return null;
	try {
		const list = JSON.parse(raw);
		if (!Array.isArray(list)) return null;
		return list
			.filter((p) => p && typeof p.name === "string" && typeof p.path === "string")
			.map((p) => ({ name: p.name, path: p.path }));
	} catch {
		return null;
	}
}

/**
 * How well `text` matches the query: 4 starts with it, 3 a word starts with
 * it, 2 contains it, 1 the query's letters appear in order (initials like
 * "vsc"), 0 no match.
 */
export function matchScore(text: string, query: string): number {
	const t = text.toLowerCase();
	const q = query.toLowerCase().trim();
	if (!q) return 0;
	if (t.startsWith(q)) return 4;
	if (t.split(/[\s\-_.()]+/).some((w) => w.startsWith(q))) return 3;
	if (t.includes(q)) return 2;
	if (q.length >= 2) {
		let i = 0;
		for (const ch of t) if (ch === q[i]) i++;
		if (i === q.length) return 1;
	}
	return 0;
}

/** A colour per file type for the recent-files icons. */
export function fileTone(ext: string): string {
	const e = ext.toLowerCase();
	if (e === "pdf") return "#e5484d";
	if (["doc", "docx", "rtf", "odt"].includes(e)) return "#2b5797";
	if (["xls", "xlsx", "csv", "ods"].includes(e)) return "#1e7145";
	if (["ppt", "pptx", "odp", "key"].includes(e)) return "#d24726";
	if (["zip", "rar", "7z", "tar", "gz"].includes(e)) return "#e8a33d";
	if (["png", "jpg", "jpeg", "gif", "webp", "heic", "svg", "bmp"].includes(e)) return "#d9467a";
	if (["mp4", "mov", "mkv", "avi", "mp3", "wav", "m4a"].includes(e)) return "#7b68ee";
	if (["java", "cpp", "c", "h", "ts", "tsx", "js", "py", "rs", "html", "css", "json"].includes(e)) return "#2b7de9";
	return "#6b7280";
}

/** Settings pages Start's search can open, with words people search for. */
export const SETTINGS_PAGES: { name: string; uri: string; keywords: string[] }[] = [
	{ name: "Wi-Fi", uri: "ms-settings:network-wifi", keywords: ["wifi", "wireless", "internet", "network"] },
	{ name: "Bluetooth & devices", uri: "ms-settings:bluetooth", keywords: ["bluetooth", "headphones", "pair"] },
	{ name: "Display", uri: "ms-settings:display", keywords: ["screen", "resolution", "brightness", "scale"] },
	{ name: "Night light", uri: "ms-settings:nightlight", keywords: ["blue light", "warm"] },
	{ name: "Sound", uri: "ms-settings:sound", keywords: ["audio", "volume", "speakers", "microphone"] },
	{ name: "Notifications", uri: "ms-settings:notifications", keywords: ["alerts", "do not disturb"] },
	{ name: "Focus", uri: "ms-settings:quiethours", keywords: ["do not disturb", "quiet"] },
	{ name: "Power & battery", uri: "ms-settings:powersleep", keywords: ["battery", "sleep", "energy saver", "power"] },
	{ name: "Storage", uri: "ms-settings:storagesense", keywords: ["disk", "space", "cleanup"] },
	{ name: "Multitasking", uri: "ms-settings:multitasking", keywords: ["snap", "tablet", "desktops"] },
	{ name: "Personalisation", uri: "ms-settings:personalization", keywords: ["theme", "personalization"] },
	{ name: "Background", uri: "ms-settings:personalization-background", keywords: ["wallpaper"] },
	{ name: "Colours", uri: "ms-settings:colors", keywords: ["dark mode", "light mode", "accent", "colors"] },
	{ name: "Installed apps", uri: "ms-settings:appsfeatures", keywords: ["uninstall", "programs"] },
	{ name: "Default apps", uri: "ms-settings:defaultapps", keywords: ["browser", "open with"] },
	{ name: "Startup apps", uri: "ms-settings:startupapps", keywords: ["launch at login", "boot"] },
	{ name: "Your info", uri: "ms-settings:yourinfo", keywords: ["account", "profile", "picture"] },
	{ name: "Sign-in options", uri: "ms-settings:signinoptions", keywords: ["password", "pin", "fingerprint", "hello"] },
	{ name: "Date & time", uri: "ms-settings:dateandtime", keywords: ["clock", "time zone"] },
	{ name: "Language & region", uri: "ms-settings:regionlanguage", keywords: ["keyboard", "input"] },
	{ name: "Typing", uri: "ms-settings:typing", keywords: ["keyboard", "autocorrect"] },
	{ name: "Mouse", uri: "ms-settings:mousetouchpad", keywords: ["cursor", "scroll"] },
	{ name: "Touchpad", uri: "ms-settings:devices-touchpad", keywords: ["trackpad", "gestures"] },
	{ name: "Pen & Windows Ink", uri: "ms-settings:pen", keywords: ["stylus"] },
	{ name: "Printers & scanners", uri: "ms-settings:printers", keywords: ["print"] },
	{ name: "VPN", uri: "ms-settings:network-vpn", keywords: ["proxy"] },
	{ name: "Mobile hotspot", uri: "ms-settings:network-mobilehotspot", keywords: ["tethering", "share internet"] },
	{ name: "Privacy & security", uri: "ms-settings:privacy", keywords: ["permissions", "camera", "location"] },
	{ name: "Windows Update", uri: "ms-settings:windowsupdate", keywords: ["updates", "upgrade"] },
	{ name: "Accessibility", uri: "ms-settings:easeofaccess", keywords: ["text size", "narrator", "magnifier"] }
];
