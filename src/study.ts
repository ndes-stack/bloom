// Study stats: focus time per module, recorded while the notch's timer runs.
// Pure helpers (no Tauri), so they're easy to test.
//
// The log is kept per day and per module, in seconds, and saved as one
// setting (bloom-study-log). Days older than LOG_DAYS are dropped.

export const STUDY_LOG_KEY = "bloom-study-log";
/** The module the next focus session counts towards ("" = none). */
export const STUDY_MODULE_KEY = "bloom-study-module";
/** Modules added by hand, on top of the ones found in the calendar (JSON list). */
export const STUDY_MODULES_KEY = "bloom-study-modules";

const LOG_DAYS = 180;
/** A day counts towards the streak once it has this much focus time. */
export const STREAK_MIN_SECONDS = 5 * 60;

export interface StudyLog {
	/** "YYYY-MM-DD" -> module -> seconds. Module "" is time without a module. */
	days: Record<string, Record<string, number>>;
	/** "YYYY-MM-DD" -> timers that ran to the end. */
	done: Record<string, number>;
}

export const emptyLog = (): StudyLog => ({ days: {}, done: {} });

/** Local calendar day, "YYYY-MM-DD". */
export function dayKey(d: Date): string {
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** "COS 226", "WTW285", "IMY-220 Lecture" -> "COS 226"; null when there's no code. */
export function moduleCode(text: string): string | null {
	const m = /\b([A-Z]{3,4})[\s-]?(\d{3}[A-Z]?)\b/.exec(text.toUpperCase());
	return m ? `${m[1]} ${m[2]}` : null;
}

/** Tidies a module typed by hand: a module code if it holds one, else trimmed text. */
export function normalizeModule(text: string): string {
	const trimmed = text.replace(/\s+/g, " ").trim().slice(0, 24);
	return moduleCode(trimmed) ?? trimmed;
}

/** A stored log, or an empty one. Drops anything malformed and days past LOG_DAYS. */
export function parseStudyLog(value: unknown, now = new Date()): StudyLog {
	let raw: unknown = value;
	if (typeof value === "string") {
		try {
			raw = JSON.parse(value);
		} catch {
			raw = null;
		}
	}
	const log = emptyLog();
	if (!raw || typeof raw !== "object") return log;
	const oldest = dayKey(addDays(now, -LOG_DAYS));
	const src = raw as { days?: unknown; done?: unknown };
	if (src.days && typeof src.days === "object") {
		for (const [day, mods] of Object.entries(src.days as Record<string, unknown>)) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < oldest || !mods || typeof mods !== "object") continue;
			const clean: Record<string, number> = {};
			for (const [mod, secs] of Object.entries(mods as Record<string, unknown>)) {
				if (typeof secs === "number" && Number.isFinite(secs) && secs > 0) clean[mod] = Math.round(secs);
			}
			if (Object.keys(clean).length) log.days[day] = clean;
		}
	}
	if (src.done && typeof src.done === "object") {
		for (const [day, n] of Object.entries(src.done as Record<string, unknown>)) {
			if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day >= oldest && typeof n === "number" && n > 0) {
				log.done[day] = Math.round(n);
			}
		}
	}
	return log;
}

/** The log with `seconds` more focus time for `module` on `at`'s day. */
export function addFocus(log: StudyLog, at: Date, module: string, seconds: number): StudyLog {
	const day = dayKey(at);
	const mods = { ...(log.days[day] ?? {}) };
	mods[module] = (mods[module] ?? 0) + seconds;
	return { ...log, days: { ...log.days, [day]: mods } };
}

/** The log with one more finished timer on `at`'s day. */
export function addDone(log: StudyLog, at: Date): StudyLog {
	const day = dayKey(at);
	return { ...log, done: { ...log.done, [day]: (log.done[day] ?? 0) + 1 } };
}

const dayTotal = (log: StudyLog, day: string) =>
	Object.values(log.days[day] ?? {}).reduce((a, b) => a + b, 0);

/** Monday of `d`'s week. */
export function weekStart(d: Date): Date {
	return addDays(d, -((d.getDay() + 6) % 7));
}

export type StudyRange = "today" | "week";

export interface StudySummary {
	total: number;
	/** Most time first. */
	byModule: [string, number][];
	/** Monday to Sunday totals of the week (only filled for "week"). */
	perDay: number[];
	sessions: number;
	/** Days in a row with at least STREAK_MIN_SECONDS, up to today (or yesterday). */
	streak: number;
}

export function summarize(log: StudyLog, now: Date, range: StudyRange): StudySummary {
	const days =
		range === "today"
			? [dayKey(now)]
			: Array.from({ length: 7 }, (_, i) => dayKey(addDays(weekStart(now), i)));
	const mods = new Map<string, number>();
	let sessions = 0;
	for (const day of days) {
		for (const [mod, secs] of Object.entries(log.days[day] ?? {})) mods.set(mod, (mods.get(mod) ?? 0) + secs);
		sessions += log.done[day] ?? 0;
	}
	const byModule = [...mods.entries()].sort((a, b) => b[1] - a[1]);
	const total = byModule.reduce((a, [, s]) => a + s, 0);
	const perDay = range === "week" ? days.map((d) => dayTotal(log, d)) : [];
	// Today still counts as "in progress": a streak isn't broken until a whole
	// day passes without study.
	let streak = 0;
	let cursor = dayTotal(log, dayKey(now)) >= STREAK_MIN_SECONDS ? now : addDays(now, -1);
	while (dayTotal(log, dayKey(cursor)) >= STREAK_MIN_SECONDS) {
		streak++;
		cursor = addDays(cursor, -1);
	}
	return { total, byModule, perDay, sessions, streak };
}

/** "1h 25m", "25m", "40s", "0m". */
export function studyDuration(seconds: number): string {
	const s = Math.max(0, Math.round(seconds));
	if (s > 0 && s < 60) return `${s}s`;
	const totalMin = Math.floor(s / 60);
	const h = Math.floor(totalMin / 60);
	const m = totalMin % 60;
	if (h === 0) return `${m}m`;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const PALETTE = [
	"#0a84ff",
	"#30d158",
	"#ff9f0a",
	"#bf5af2",
	"#ff375f",
	"#64d2ff",
	"#ffd60a",
	"#ac8e68",
	"#5e5ce6",
	"#ff6482",
	"#66d4cf",
	"#a2845e"
];

export type ModuleColors = Map<string, string>;

/**
 * A colour per module, all different for the first twelve: modules take the
 * next colour in the order they first appear in the log (oldest first), then
 * in `others`' order. Colours stay put as new modules come along.
 */
export function moduleColorMap(log: StudyLog, others: string[] = []): ModuleColors {
	const map: ModuleColors = new Map();
	const take = (m: string) => {
		if (!m || map.has(m)) return;
		map.set(m, PALETTE[map.size % PALETTE.length]);
	};
	for (const day of Object.keys(log.days).sort()) Object.keys(log.days[day]).sort().forEach(take);
	others.forEach(take);
	return map;
}

/** The module's colour from `colors`; grey for "no module". */
export function moduleColor(module: string, colors?: ModuleColors): string {
	if (!module) return "#8e8e93";
	const known = colors?.get(module);
	if (known) return known;
	let h = 0;
	for (const ch of module) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return PALETTE[h % PALETTE.length];
}

/** Modules to offer: hand-added, then any in the log or calendar, without repeats. */
export function moduleChoices(custom: string[], log: StudyLog, calendarTitles: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	const add = (m: string | null) => {
		if (m && !seen.has(m)) {
			seen.add(m);
			out.push(m);
		}
	};
	custom.forEach(add);
	calendarTitles.forEach((t) => add(moduleCode(t)));
	Object.values(log.days).forEach((mods) => Object.keys(mods).forEach((m) => add(m || null)));
	return out;
}

export function parseModuleList(value: unknown): string[] {
	let raw: unknown = value;
	if (typeof value === "string") {
		try {
			raw = JSON.parse(value);
		} catch {
			raw = null;
		}
	}
	return Array.isArray(raw)
		? raw.filter((m): m is string => typeof m === "string" && m.trim() !== "").map(normalizeModule).slice(0, 30)
		: [];
}

/** The daily focus goal in minutes (Settings > Notch > Calendar & Timer). */
export const STUDY_GOAL_KEY = "bloom-study-goal";
export const GOAL_CHOICES = [60, 120, 180, 240, 360, 480] as const;
export const DEFAULT_GOAL_MINUTES = 240;

export function parseGoal(value: unknown): number {
	const n = Number(value);
	return Number.isFinite(n) && n >= 15 && n <= 1440 ? Math.round(n) : DEFAULT_GOAL_MINUTES;
}

/** Today's focus against the goal: seconds done, seconds wanted, and 0 to 1. */
export function goalProgress(log: StudyLog, now: Date, goalMinutes: number) {
	const done = Object.values(log.days[dayKey(now)] ?? {}).reduce((a, s) => a + s, 0);
	const target = Math.max(1, goalMinutes) * 60;
	return { done, target, progress: Math.min(1, done / target), met: done >= target };
}
