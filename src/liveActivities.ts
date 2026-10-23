// Live activities (Settings > Appearance > Live Activities).
//
// Things happening right now (a class coming up, something due, a timer,
// music, plugging in) are gathered into one list, most urgent first, and
// shown in the style picked in Settings:
//   island – the notch itself stretches to show it (Bloom's original look)
//   glow   – the notch stays small, swaps its text, and a coloured line glows
//            along its bottom edge
//   tags   – little labels hang under the notch on thin strings
//   rail   – a thin readout strip slides out from both sides of the notch
//   cards  – a light card drops out below; ongoing things show as chips

export const ACTIVITY_STYLE_KEY = "bloom-activity-style";
/** Show a dot beside the notch while an app uses the camera or microphone. */
export const PRIVACY_DOT_KEY = "bloom-privacy-dot";
/** Keep the notch out while a timer runs, and "Time's up" until dismissed. */
export const KEEP_TIMER_VISIBLE_KEY = "bloom-timer-keep-visible";

export type ActivityStyle = "island" | "glow" | "tags" | "rail" | "cards";
export const ACTIVITY_STYLES: ActivityStyle[] = ["island", "glow", "tags", "rail", "cards"];

export function parseActivityStyle(value: unknown): ActivityStyle {
	const v = String(value ?? "");
	return (ACTIVITY_STYLES as string[]).includes(v) ? (v as ActivityStyle) : "island";
}

export type ActivityKind =
	| "timer-done"
	| "low-battery"
	| "deadline"
	| "class"
	| "update"
	| "power"
	| "timer"
	| "music";

export type ActivityTone = "accent" | "green" | "red" | "orange" | "neutral";

export interface Activity {
	id: string;
	kind: ActivityKind;
	/** Short upper-case word for the rail ("CLASS", "TIMER"). */
	label: string;
	title: string;
	detail?: string;
	/** The number that matters: "in 10 min", "64%", "18:42". */
	value?: string;
	tone: ActivityTone;
	/** 0..1, drawn as the glow line's length or a ring. */
	progress?: number;
	art?: string | null;
	/** True for things that come and go (reminders, plugging in), false for ongoing ones. */
	alert: boolean;
	/** Reminders can be snoozed and dismissed. */
	snoozable?: boolean;
	dismissable?: boolean;
}

const PRIORITY: Record<ActivityKind, number> = {
	"timer-done": 0,
	"low-battery": 1,
	deadline: 2,
	class: 3,
	update: 4,
	power: 5,
	timer: 6,
	music: 7
};

/** Most urgent first. */
export function sortActivities(list: Activity[]): Activity[] {
	return [...list].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);
}

/** Text colour for a tone on the notch. The --tone-* colours are darker in
 * light mode so they stay readable (see App.css). */
export function toneColor(tone: ActivityTone): string {
	switch (tone) {
		case "green":
			return "var(--tone-green, #30d158)";
		case "red":
			return "var(--tone-red, #ff6961)";
		case "orange":
			return "var(--tone-orange, #ff9f6b)";
		case "neutral":
			return "var(--bloom-text, #fff)";
		default:
			return "var(--bloom-accent-text, var(--bloom-accent, #0a84ff))";
	}
}

/** Text colour for a tone on the light cards (darker, so it reads on white). */
export function toneColorOnLight(tone: ActivityTone): string {
	switch (tone) {
		case "green":
			return "#1f8a3f";
		case "red":
			return "#c9302c";
		case "orange":
			return "#b4501b";
		case "neutral":
			return "#1c1d21";
		default:
			return "var(--bloom-accent, #0a84ff)";
	}
}
