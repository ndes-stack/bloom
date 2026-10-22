// Class reminders (Settings > Notch > Class Reminders).
//
// A little before an event on the linked calendar starts, the closed notch
// stretches into a slim bar at the top of the screen that says what's next,
// then shrinks back. Hovering the bar shows the time and place with Snooze,
// Open and Dismiss.

import type { CalendarEvent } from "./calendarIcs";

export const REMINDERS_ENABLED_KEY = "bloom-reminders-enabled";
export const REMINDER_LEAD_KEY = "bloom-reminder-lead";
export const REMINDER_DURATION_KEY = "bloom-reminder-duration";
export const REMINDER_WIDTH_KEY = "bloom-reminder-width";
export const REMINDER_SKIP_ALLDAY_KEY = "bloom-reminder-skip-allday";
export const REMINDER_SOUND_KEY = "bloom-reminder-sound";
/** Local-only: which events have already been announced. */
export const REMINDERS_SHOWN_KEY = "bloom-reminders-shown";
/** Emitted by Settings to show a dummy reminder with the current settings. */
export const REMINDER_PREVIEW_EVENT = "reminder-preview";

export const REMINDER_LEAD_OPTIONS = [5, 10, 15, 30] as const;
/** Seconds on screen; 0 = until dismissed. */
export const REMINDER_DURATION_OPTIONS = [8, 15, 30, 0] as const;
export type ReminderWidth = "compact" | "wide";
export const REMINDER_BAR_WIDTHS: Record<ReminderWidth, number> = { compact: 440, wide: 600 };
/** Collapsed bar height, and with the hover details row. */
export const REMINDER_BAR_HEIGHT = 36;
export const REMINDER_BAR_HOVER_HEIGHT = 84;
export const REMINDER_SNOOZE_MS = 5 * 60 * 1000;

export interface Reminder {
	/** Event id plus start time, unique per occurrence. */
	key: string;
	title: string;
	location?: string;
	start: Date;
	end: Date;
	preview: boolean;
}

export function parseBool(value: unknown, fallback: boolean): boolean {
	if (value === true || value === "true") return true;
	if (value === false || value === "false") return false;
	return fallback;
}

function pick<T extends number>(value: unknown, options: readonly T[], fallback: T): T {
	const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
	return (options as readonly number[]).includes(n) ? (n as T) : fallback;
}

export const parseReminderLead = (v: unknown) => pick(v, REMINDER_LEAD_OPTIONS, 10);
export const parseReminderDuration = (v: unknown) => pick(v, REMINDER_DURATION_OPTIONS, 15);
export const parseReminderWidth = (v: unknown): ReminderWidth => (v === "compact" ? "compact" : "wide");

export function reminderKey(ev: CalendarEvent): string {
	return `${ev.id}@${ev.start.getTime()}`;
}

/** The earliest event starting within `leadMin` minutes that hasn't been announced. */
export function dueEvent(
	events: CalendarEvent[],
	now: Date,
	leadMin: number,
	skipAllDay: boolean,
	shown: ReadonlySet<string>
): CalendarEvent | null {
	const t = now.getTime();
	let best: CalendarEvent | null = null;
	for (const ev of events) {
		if (skipAllDay && ev.allDay) continue;
		const until = ev.start.getTime() - t;
		if (until <= 0 || until > leadMin * 60_000) continue;
		if (shown.has(reminderKey(ev))) continue;
		if (!best || ev.start < best.start) best = ev;
	}
	return best;
}

/** "in 10 min", "in 1 h 5 min", "now". */
export function startsIn(start: Date, now: Date): string {
	const mins = Math.ceil((start.getTime() - now.getTime()) / 60_000);
	if (mins <= 0) return "now";
	if (mins < 60) return `in ${mins} min`;
	const h = Math.floor(mins / 60);
	return `in ${h} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
}

export function clockText(d: Date, use24h: boolean): string {
	const m = d.getMinutes().toString().padStart(2, "0");
	if (use24h) return `${d.getHours().toString().padStart(2, "0")}:${m}`;
	return `${d.getHours() % 12 || 12}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

export function loadShown(): Set<string> {
	try {
		const list = JSON.parse(localStorage.getItem(REMINDERS_SHOWN_KEY) || "[]");
		return new Set(Array.isArray(list) ? list.filter((x) => typeof x === "string") : []);
	} catch {
		return new Set();
	}
}

/** Remembers the last 100 announced events so a restart doesn't repeat them. */
export function saveShown(shown: Set<string>) {
	try {
		localStorage.setItem(REMINDERS_SHOWN_KEY, JSON.stringify([...shown].slice(-100)));
	} catch {
		// Only means a reminder could show again after a restart.
	}
}

/** A made-up reminder for the Settings preview. */
export function previewReminder(leadMin: number): Reminder {
	const start = new Date(Date.now() + leadMin * 60_000);
	return {
		key: `preview-${Date.now()}`,
		title: "Example Lecture",
		location: "Room 2-27",
		start,
		end: new Date(start.getTime() + 50 * 60_000),
		preview: true
	};
}
