// Short notices in the pill: a device running low, rain on the way, the
// daily goal met, and the nudge when a distracting app comes to the front
// during a focus session. Each has its own switch in Settings.
export const DEVICE_BATTERY_NOTICE_KEY = "bloom-notice-device-battery";
export const RAIN_NOTICE_KEY = "bloom-notice-rain";
export const GOAL_NOTICE_KEY = "bloom-notice-goal";
export const NUDGE_KEY = "bloom-focus-nudge";
export const NUDGE_APPS_KEY = "bloom-focus-nudge-apps";
export const LYRICS_KEY = "bloom-lyrics-enabled";

export const DEFAULT_NUDGE_APPS = "youtube, netflix, tiktok, instagram, twitch, reddit";

export const parseOn = (v: unknown): boolean => v !== "false" && v !== false;
export const parseOff = (v: unknown): boolean => v === "true" || v === true;

/** The words to look for, lower case, at most 30. */
export function parseNudgeApps(v: unknown): string[] {
	const text = typeof v === "string" ? v : DEFAULT_NUDGE_APPS;
	return text
		.split(",")
		.map((w) => w.trim().toLowerCase())
		.filter((w) => w.length >= 2)
		.slice(0, 30);
}

/** The first listed word found in the front app's exe name or window title. */
export function nudgeMatch(words: string[], app: { exe: string; title: string }): string | null {
	const hay = `${app.exe} ${app.title}`.toLowerCase();
	return words.find((w) => hay.includes(w)) ?? null;
}

export type NoticeTone = "accent" | "red" | "green" | "orange" | "blue";
export type NoticeIcon = "battery" | "rain" | "flame" | "focus";

export interface Notice {
	/** One notice per id at a time; a new one with the same id replaces it. */
	id: string;
	icon: NoticeIcon;
	title: string;
	detail?: string;
	tone: NoticeTone;
}

export const NOTICE_COLORS: Record<NoticeTone, string> = {
	accent: "var(--bloom-accent, #0a84ff)",
	red: "#ff453a",
	green: "#32d74b",
	orange: "#ff9f0a",
	blue: "#64d2ff"
};

/** "in 25 min", rounded to five minutes; "soon" under five. */
export function rainIn(at: number, now: number): string {
	const minutes = Math.round((at - now) / 60_000 / 5) * 5;
	return minutes < 5 ? "soon" : `in ${minutes} min`;
}
