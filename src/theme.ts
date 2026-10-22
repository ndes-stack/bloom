import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { reloadIfMirrorWasStale } from "./hooks/settingsMirror";

// Convert a hex color string to rgba with a specified alpha
function hexToRgba(hex: string, alpha: number): string {
	hex = hex.replace("#", "");
	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((char) => char + char)
			.join("");
	}
	const r = parseInt(hex.substring(0, 2), 16) || 0;
	const g = parseInt(hex.substring(2, 4), 16) || 0;
	const b = parseInt(hex.substring(4, 6), 16) || 0;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface HSL {
	h: number;
	s: number;
	l: number;
}

// Convert Hex to HSL
export function hexToHsl(hex: string): HSL {
	hex = hex.replace("#", "");
	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((char) => char + char)
			.join("");
	}
	const r = (parseInt(hex.substring(0, 2), 16) || 0) / 255;
	const g = (parseInt(hex.substring(2, 4), 16) || 0) / 255;
	const b = (parseInt(hex.substring(4, 6), 16) || 0) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Convert HSL back to Hex color string
function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0,
		g = 0,
		b = 0;

	if (0 <= h && h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (60 <= h && h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (120 <= h && h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (180 <= h && h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (240 <= h && h < 300) {
		r = x;
		g = 0;
		b = c;
	} else if (300 <= h && h < 360) {
		r = c;
		g = 0;
		b = x;
	}

	const toHex = (val: number) => {
		const hexVal = Math.round((val + m) * 255).toString(16);
		return hexVal.length === 1 ? "0" + hexVal : hexVal;
	};

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

type SystemTheme = "light" | "dark";

// Last Windows light/dark app mode we saw. Lets "system" mode paint instantly
// on later calls instead of waiting for the backend round trip.
let cachedSystemTheme: SystemTheme | null = null;

// Best synchronous guess at the Windows app mode. WebView2 mirrors the
// Windows setting through prefers-color-scheme, so it is right in practice.
function guessSystemTheme(): SystemTheme {
	if (cachedSystemTheme) return cachedSystemTheme;
	try {
		if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
	} catch {
		// matchMedia unavailable, fall through to dark
	}
	return "dark";
}

// Ask the backend, which reads the Windows registry directly.
async function resolveSystemTheme(): Promise<SystemTheme> {
	try {
		const theme = await invoke<string>("get_system_theme");
		cachedSystemTheme = theme === "light" ? "light" : "dark";
	} catch (e) {
		console.error("Failed to read system theme:", e);
		cachedSystemTheme = guessSystemTheme();
	}
	return cachedSystemTheme;
}

export async function applyTheme(
	mode: string,
	customColor: string,
	opacity?: number,
	saturation?: number,
	brightness?: number
) {
	const root = document.documentElement;

	// "system" follows the Windows light/dark app mode. Paint the best guess
	// right away so there is no flash, then confirm with the backend and
	// repaint only if the guess was wrong.
	if (mode === "system") {
		const guess = guessSystemTheme();
		applyTheme(guess, customColor, opacity, saturation, brightness);
		const actual = await resolveSystemTheme();
		const stillSystem = (localStorage.getItem("bloom-theme-mode") || "dark") === "system";
		if (actual !== guess && stillSystem) {
			applyTheme(actual, customColor, opacity, saturation, brightness);
		}
		return;
	}

	if (opacity === undefined || opacity === null) {
		const cachedOpacity = localStorage.getItem("bloom-theme-opacity");
		opacity = cachedOpacity !== null ? parseFloat(cachedOpacity) : 0.8;
	}

	if (saturation === undefined || saturation === null) {
		const cachedSaturation = localStorage.getItem("bloom-theme-saturation");
		saturation = cachedSaturation !== null ? parseFloat(cachedSaturation) : 0.5;
	}

	if (brightness === undefined || brightness === null) {
		const cachedBrightness = localStorage.getItem("bloom-theme-brightness");
		brightness = cachedBrightness !== null ? parseFloat(cachedBrightness) : 0.15;
	}

	const op = opacity;
	const opExpanded = Math.min(1.0, opacity + 0.12);

	if (mode === "light") {
		root.style.setProperty("--bloom-bg", `rgba(255, 255, 255, ${op})`);
		root.style.setProperty("--bloom-bg-expanded", `rgba(245, 245, 247, ${opExpanded})`);
		root.style.setProperty("--bloom-text", "#1c1c1e");
		root.style.setProperty("--bloom-text-muted", "rgba(28, 28, 30, 0.65)");
		root.style.setProperty("--bloom-border", "rgba(0, 0, 0, 0.12)");
		root.style.setProperty("--bloom-group-bg", "rgba(0, 0, 0, 0.04)");
		root.style.setProperty("--bloom-accent", "#007aff");
		root.style.setProperty("--bloom-scrollbar-thumb", "rgba(0, 0, 0, 0.15)");
		root.classList.add("light-mode");
		root.classList.remove("dark-mode");
		root.classList.add("theme-light");
		root.classList.remove("theme-dark", "theme-custom", "theme-adaptive");
	} else if (mode === "custom") {
		const hsl = hexToHsl(customColor);
		hsl.s = saturation * 100;
		hsl.l = brightness * 100;
		const finalBgColor = hslToHex(hsl.h, hsl.s, hsl.l);
		const isLight = brightness > 0.55;

		root.style.setProperty("--bloom-bg", hexToRgba(finalBgColor, op));
		root.style.setProperty("--bloom-bg-expanded", hexToRgba(finalBgColor, opExpanded));
		root.style.setProperty("--bloom-text", isLight ? "#1c1c1e" : "#ffffff");
		root.style.setProperty(
			"--bloom-text-muted",
			isLight ? "rgba(28, 28, 30, 0.65)" : "rgba(255, 255, 255, 0.65)"
		);
		root.style.setProperty(
			"--bloom-border",
			isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)"
		);
		root.style.setProperty(
			"--bloom-group-bg",
			isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.04)"
		);
		root.style.setProperty("--bloom-accent", customColor);
		root.style.setProperty(
			"--bloom-scrollbar-thumb",
			isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)"
		);
		root.classList.add("theme-custom");
		root.classList.remove("theme-light", "theme-dark", "theme-adaptive");
		if (isLight) {
			root.classList.add("light-mode");
			root.classList.remove("dark-mode");
		} else {
			root.classList.add("dark-mode");
			root.classList.remove("light-mode");
		}
	} else if (mode === "adaptive") {
		try {
			const accentHex = await invoke<string>("get_system_accent_color");
			const hsl = hexToHsl(accentHex);
			hsl.s = saturation * 100;
			hsl.l = brightness * 100;
			const finalBgColor = hslToHex(hsl.h, hsl.s, hsl.l);
			const isLight = brightness > 0.55;

			root.style.setProperty("--bloom-bg", hexToRgba(finalBgColor, op));
			root.style.setProperty("--bloom-bg-expanded", hexToRgba(finalBgColor, opExpanded));
			root.style.setProperty("--bloom-text", isLight ? "#1c1c1e" : "#ffffff");
			root.style.setProperty(
				"--bloom-text-muted",
				isLight ? "rgba(28, 28, 30, 0.65)" : "rgba(255, 255, 255, 0.65)"
			);
			root.style.setProperty(
				"--bloom-border",
				isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)"
			);
			root.style.setProperty(
				"--bloom-group-bg",
				isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.04)"
			);
			root.style.setProperty("--bloom-accent", accentHex);
			root.style.setProperty(
				"--bloom-scrollbar-thumb",
				isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)"
			);
			root.classList.add("theme-adaptive");
			root.classList.remove("theme-light", "theme-dark", "theme-custom");
			if (isLight) {
				root.classList.add("light-mode");
				root.classList.remove("dark-mode");
			} else {
				root.classList.add("dark-mode");
				root.classList.remove("light-mode");
			}
		} catch (e) {
			console.error("Failed to apply adaptive theme:", e);
			applyTheme("dark", customColor, op, saturation, brightness);
		}
	} else {
		// default/dark
		root.style.setProperty("--bloom-bg", `rgba(0, 0, 0, ${op})`);
		root.style.setProperty("--bloom-bg-expanded", `rgba(0, 0, 0, ${opExpanded})`);
		root.style.setProperty("--bloom-text", "#ffffff");
		root.style.setProperty("--bloom-text-muted", "rgba(255, 255, 255, 0.6)");
		root.style.setProperty("--bloom-border", "rgba(255, 255, 255, 0.1)");
		root.style.setProperty("--bloom-group-bg", "rgba(255, 255, 255, 0.04)");
		root.style.setProperty("--bloom-accent", "#007aff");
		root.style.setProperty("--bloom-scrollbar-thumb", "rgba(255, 255, 255, 0.1)");
		root.classList.add("dark-mode");
		root.classList.remove("light-mode");
		root.classList.add("theme-dark");
		root.classList.remove("theme-light", "theme-custom", "theme-adaptive");
	}

	applyAccentOverride(root);
}

// ── Accent colour ───────────────────────────────────────────────────────
// Settings > Appearance > Accent Colour. Independent of the theme mode, so
// it works with Automatic (Match Windows) as well as dark/light/custom.
// Empty = keep the theme's own accent.

export const ACCENT_COLOR_KEY = "bloom-accent-color";

export function parseAccentColor(value: unknown): string | null {
	const v = typeof value === "string" ? value.trim() : "";
	return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
}

/** Dark text on light accents (yellow, mint), white on the rest. */
export function textOnAccent(hex: string): string {
	const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
	if (!m) return "#ffffff";
	const lin = (c: string) => {
		const v = parseInt(c, 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	const lum = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
	return lum > 0.45 ? "#1c1c1e" : "#ffffff";
}

/** Copies an accent value from a settings event into localStorage. */
function mirrorAccent(value: unknown) {
	try {
		const accent = parseAccentColor(value);
		if (accent) localStorage.setItem(ACCENT_COLOR_KEY, accent);
		else localStorage.removeItem(ACCENT_COLOR_KEY);
	} catch {
		// Storage unavailable: the theme keeps its own accent.
	}
}

function applyAccentOverride(root: HTMLElement) {
	let override: string | null = null;
	try {
		override = parseAccentColor(localStorage.getItem(ACCENT_COLOR_KEY));
	} catch {
		override = null;
	}
	if (override) root.style.setProperty("--bloom-accent", override);
	const accent = root.style.getPropertyValue("--bloom-accent").trim() || "#007aff";
	root.style.setProperty("--bloom-on-accent", textOnAccent(accent));
}

export function initTheme() {
	const syncMode = localStorage.getItem("bloom-theme-mode") || "dark";
	const syncColor = localStorage.getItem("bloom-theme-color") || "#007aff";
	const syncOpacityVal = localStorage.getItem("bloom-theme-opacity");
	const syncOpacity = syncOpacityVal !== null ? parseFloat(syncOpacityVal) : 0.8;
	const syncSaturationVal = localStorage.getItem("bloom-theme-saturation");
	const syncSaturation = syncSaturationVal !== null ? parseFloat(syncSaturationVal) : 0.5;
	const syncBrightnessVal = localStorage.getItem("bloom-theme-brightness");
	const syncBrightness = syncBrightnessVal !== null ? parseFloat(syncBrightnessVal) : 0.15;

	// Fast synchronous draw using cached localStorage
	applyTheme(syncMode, syncColor, syncOpacity, syncSaturation, syncBrightness);

	// Sync settings.json in background to avoid flickers
	invoke<Record<string, any>>("load_settings")
		.then(async (settings) => {
			// Don't write a stale mirror value back while the window reloads.
			if (await reloadIfMirrorWasStale(settings)) return;
			const mode = settings["bloom-theme-mode"] ? String(settings["bloom-theme-mode"]) : syncMode;
			const color = settings["bloom-theme-color"]
				? String(settings["bloom-theme-color"])
				: syncColor;
			const opacityVal = settings["bloom-theme-opacity"]
				? parseFloat(String(settings["bloom-theme-opacity"]))
				: syncOpacity;
			const saturationVal = settings["bloom-theme-saturation"]
				? parseFloat(String(settings["bloom-theme-saturation"]))
				: syncSaturation;
			const brightnessVal = settings["bloom-theme-brightness"]
				? parseFloat(String(settings["bloom-theme-brightness"]))
				: syncBrightness;

			// Accent colour lives in settings.json as well; mirror it before drawing.
			const storedAccent = parseAccentColor(settings[ACCENT_COLOR_KEY]) ?? "";
			const accentChanged = storedAccent !== (localStorage.getItem(ACCENT_COLOR_KEY) ?? "");
			if (accentChanged) {
				if (storedAccent) localStorage.setItem(ACCENT_COLOR_KEY, storedAccent);
				else localStorage.removeItem(ACCENT_COLOR_KEY);
			}

			if (
				accentChanged ||
				mode !== syncMode ||
				color !== syncColor ||
				opacityVal !== syncOpacity ||
				saturationVal !== syncSaturation ||
				brightnessVal !== syncBrightness
			) {
				localStorage.setItem("bloom-theme-mode", mode);
				localStorage.setItem("bloom-theme-color", color);
				localStorage.setItem("bloom-theme-opacity", String(opacityVal));
				localStorage.setItem("bloom-theme-saturation", String(saturationVal));
				localStorage.setItem("bloom-theme-brightness", String(brightnessVal));
				applyTheme(mode, color, opacityVal, saturationVal, brightnessVal);
			}
		})
		.catch(console.error);

	// Helper: read all theme values from localStorage and apply
	const applyThemeFromStorage = () => {
		const mode = localStorage.getItem("bloom-theme-mode") || "dark";
		const color = localStorage.getItem("bloom-theme-color") || "#007aff";
		const opacity = parseFloat(localStorage.getItem("bloom-theme-opacity") || "0.80");
		const saturation = parseFloat(localStorage.getItem("bloom-theme-saturation") || "0.50");
		const brightness = parseFloat(localStorage.getItem("bloom-theme-brightness") || "0.15");
		applyTheme(mode, color, opacity, saturation, brightness);
	};

	const bloomThemeKeys = [
		"bloom-theme-mode",
		"bloom-theme-color",
		"bloom-theme-opacity",
		"bloom-theme-saturation",
		"bloom-theme-brightness",
		ACCENT_COLOR_KEY
	];

	// Listen to setting changes broadcasted from settings window
	// (localStorage sync is handled by saveAndLocal in Settings.tsx; we just apply the theme)
	const settingsPromise = listen<{ key: string; value: any }>("settings-changed", (event) => {
		const { key, value } = event.payload;
		if (key === ACCENT_COLOR_KEY) mirrorAccent(value);
		if (bloomThemeKeys.includes(key)) {
			applyThemeFromStorage();
		}
	});

	// Listen to system accent color updates in case of adaptive theme
	const accentPromise = listen<string>("system-accent-changed", (event) => {
		const currentMode = localStorage.getItem("bloom-theme-mode") || "dark";
		if (currentMode === "adaptive") {
			const opacity = parseFloat(localStorage.getItem("bloom-theme-opacity") || "0.80");
			const saturation = parseFloat(localStorage.getItem("bloom-theme-saturation") || "0.50");
			const brightness = parseFloat(localStorage.getItem("bloom-theme-brightness") || "0.15");
			applyTheme("adaptive", event.payload, opacity, saturation, brightness);
		}
	});

	// Windows switched between light and dark app mode. Only matters in "system" mode.
	const systemThemePromise = listen<string>("system-theme-changed", (event) => {
		cachedSystemTheme = event.payload === "light" ? "light" : "dark";
		if ((localStorage.getItem("bloom-theme-mode") || "dark") === "system") {
			applyThemeFromStorage();
		}
	});

	// Backup trigger: the webview also reports the OS colour scheme changing.
	let colorSchemeQuery: MediaQueryList | null = null;
	const onColorSchemeChange = () => {
		if ((localStorage.getItem("bloom-theme-mode") || "dark") === "system") {
			cachedSystemTheme = null;
			applyThemeFromStorage();
		}
	};
	try {
		colorSchemeQuery = window.matchMedia("(prefers-color-scheme: light)");
		colorSchemeQuery.addEventListener("change", onColorSchemeChange);
	} catch {
		colorSchemeQuery = null;
	}

	// Listen to external edits (e.g. settings.json edited outside the app)
	// localStorage sync is handled by useSettingsSync hook; we just apply the theme
	const externalPromise = listen<{ key: string; value: any }>(
		"settings-external-changed",
		(event) => {
			const { key, value } = event.payload;
			if (key === ACCENT_COLOR_KEY) mirrorAccent(value);
			if (bloomThemeKeys.includes(key)) {
				applyThemeFromStorage();
			}
		}
	);

	return () => {
		settingsPromise.then((f) => f());
		accentPromise.then((f) => f());
		externalPromise.then((f) => f());
		systemThemePromise.then((f) => f());
		colorSchemeQuery?.removeEventListener("change", onColorSchemeChange);
	};
}
