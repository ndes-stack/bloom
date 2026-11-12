// Theme gallery (Settings > Appearance): the whole look as one named thing.
// A theme is a set of appearance settings; applying it saves each one, so
// every window follows as it would for a change made by hand.
import { hexToHsl } from "./theme";

export const SAVED_THEMES_KEY = "bloom-themes";

/** Everything a saved theme remembers, with the value used when unset. */
export const THEME_KEYS: Record<string, string> = {
	"bloom-theme-mode": "dark",
	"bloom-theme-color": "#007aff",
	"bloom-accent-color": "",
	"bloom-theme-opacity": "0.8",
	"bloom-theme-saturation": "0.5",
	"bloom-theme-brightness": "0.15",
	"bloom-notch-material": "solid",
	"bloom-notch-blur": "28",
	"bloom-notch-tint": "55",
	"bloom-notch-shadow": "true",
	"bloom-dock-material-link": "true",
	"bloom-dock-material": "solid",
	"bloom-dock-blur": "28",
	"bloom-dock-tint": "55",
	"bloom-dock-style": "attached",
	"bloom-corners-enabled": "false",
	"bloom-activity-style": "island"
};

export interface Theme {
	name: string;
	values: Record<string, string>;
	builtIn?: boolean;
}

const custom = (color: string): Record<string, string> => {
	const hsl = hexToHsl(color);
	return {
		"bloom-theme-mode": "custom",
		"bloom-theme-color": color,
		"bloom-theme-saturation": String(hsl.s / 100),
		"bloom-theme-brightness": String(hsl.l / 100)
	};
};

const base = { "bloom-accent-color": "", "bloom-notch-material": "solid", "bloom-dock-material-link": "true" };

export const BUILT_IN_THEMES: Theme[] = [
	{ name: "Midnight", builtIn: true, values: { ...base, "bloom-theme-mode": "dark", "bloom-notch-shadow": "true" } },
	{ name: "Daylight", builtIn: true, values: { ...base, "bloom-theme-mode": "light", "bloom-notch-shadow": "true" } },
	{
		name: "Glass",
		builtIn: true,
		values: { ...base, "bloom-theme-mode": "dark", "bloom-notch-material": "glass", "bloom-notch-blur": "28", "bloom-notch-tint": "45" }
	},
	{
		name: "Frost",
		builtIn: true,
		values: { ...base, "bloom-theme-mode": "light", "bloom-notch-material": "frosted", "bloom-notch-blur": "32", "bloom-notch-tint": "60" }
	},
	{ name: "Ocean", builtIn: true, values: { ...base, ...custom("#16407a") } },
	{ name: "Forest", builtIn: true, values: { ...base, ...custom("#1f5c3d") } },
	{ name: "Plum", builtIn: true, values: { ...base, ...custom("#5a2a6e") } },
	{ name: "Ember", builtIn: true, values: { ...base, ...custom("#8a3b1c") } }
];

export function parseThemes(value: unknown): Theme[] {
	if (typeof value !== "string" || !value) return [];
	try {
		const list = JSON.parse(value);
		if (!Array.isArray(list)) return [];
		return list
			.filter((t) => t && typeof t.name === "string" && t.values && typeof t.values === "object")
			.slice(0, 24)
			.map((t) => ({
				name: t.name.slice(0, 24),
				values: Object.fromEntries(
					Object.entries(t.values as Record<string, unknown>)
						.filter(([k, v]) => k in THEME_KEYS && typeof v === "string")
						.map(([k, v]) => [k, v as string])
				)
			}));
	} catch {
		return [];
	}
}

/** The two colours a theme's card is drawn with: its surface and its accent. */
export function themeSwatch(values: Record<string, string>): { surface: string; text: string; accent: string } {
	const mode = values["bloom-theme-mode"] ?? "dark";
	const color = values["bloom-theme-color"] ?? "#007aff";
	const accent = values["bloom-accent-color"] || (mode === "custom" ? "#ffffff" : "#0a84ff");
	const material = values["bloom-notch-material"] ?? "solid";
	const see = material === "glass" ? "b3" : material === "frosted" ? "d9" : "ff";
	if (mode === "light") return { surface: `#f5f5f7${see}`, text: "#1c1c1e", accent };
	if (mode === "custom") return { surface: `${color}${see}`, text: "#ffffff", accent };
	return { surface: `#0b0b0d${see}`, text: "#ffffff", accent };
}
