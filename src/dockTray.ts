// The dock's tray end: settings keys and the small pure helpers behind its
// three panels (tray apps, quick settings, notifications and calendar).
// No Tauri imports, so this stays easy to test.

export const DOCK_TRAY_KEY = "bloom-dock-tray";

export type TrayPanelKind = "apps" | "quick" | "lang" | "calendar" | "start";

/** Notifications Windows has shared with Bloom. */
export interface TrayNotification {
	id: number;
	app_id: string;
	app_name: string;
	title: string;
	body: string;
	/** Unix ms. */
	time: number;
}

export type NotificationAccess = "allowed" | "denied" | "unspecified" | "unsupported";

export interface NotificationList {
	access: NotificationAccess;
	items: TrayNotification[];
}

export interface NotificationGroup {
	appId: string;
	appName: string;
	items: TrayNotification[];
}

/** One group per app, newest group first; items inside stay newest first. */
export function groupNotifications(items: TrayNotification[]): NotificationGroup[] {
	const groups = new Map<string, NotificationGroup>();
	const sorted = [...items].sort((a, b) => b.time - a.time);
	for (const item of sorted) {
		const key = item.app_id || item.app_name || "unknown";
		let group = groups.get(key);
		if (!group) {
			group = { appId: item.app_id, appName: item.app_name || "Notification", items: [] };
			groups.set(key, group);
		}
		group.items.push(item);
	}
	return [...groups.values()];
}

/** "now", "5 min", "2 h", "Yesterday" or a short date. */
export function relativeTime(ms: number, now: number): string {
	const diff = Math.max(0, now - ms);
	const min = Math.floor(diff / 60_000);
	if (min < 1) return "now";
	if (min < 60) return `${min} min`;
	const hours = Math.floor(min / 60);
	const then = new Date(ms);
	const today = new Date(now);
	const sameDay = then.toDateString() === today.toDateString();
	if (sameDay) return `${hours} h`;
	const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
	if (then.toDateString() === yesterday.toDateString()) return "Yesterday";
	return then.toLocaleDateString([], { day: "numeric", month: "short" });
}

export interface MonthCell {
	date: Date;
	inMonth: boolean;
}

/**
 * The month as whole weeks, Sunday first, like the Windows flyout. Only as many
 * rows as the month needs (four to six).
 */
export function monthGrid(year: number, month: number): MonthCell[] {
	const first = new Date(year, month, 1);
	const start = new Date(year, month, 1 - first.getDay());
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const rows = Math.ceil((first.getDay() + daysInMonth) / 7);
	return Array.from({ length: rows * 7 }, (_, i) => {
		const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
		return { date, inMonth: date.getMonth() === month };
	});
}

export const sameDay = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "10:47" or "10:47 AM". */
export function trayClock(d: Date, use24h: boolean): string {
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !use24h });
}

/** "Fri 23 Oct". */
export function trayDate(d: Date): string {
	const weekday = d.toLocaleDateString([], { weekday: "short" });
	const day = d.getDate();
	const month = d.toLocaleDateString([], { month: "short" });
	return `${weekday} ${day} ${month}`;
}

/** "3 h 40 min", "45 min". */
export function durationText(seconds: number): string {
	const totalMin = Math.max(1, Math.round(seconds / 60));
	const h = Math.floor(totalMin / 60);
	const m = totalMin % 60;
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export interface BatteryInfo {
	present: boolean;
	percent: number | null;
	plugged_in: boolean;
	charging: boolean;
	seconds_left: number | null;
	seconds_to_full: number | null;
}

/** The quick settings footer line. */
export function batteryLine(b: BatteryInfo | null): string {
	if (!b || !b.present || b.percent == null) return b?.plugged_in === false ? "On battery" : "Plugged in";
	const pct = `${b.percent}%`;
	if (b.charging) {
		return b.seconds_to_full ? `${pct} · full in ${durationText(b.seconds_to_full)}` : `${pct} · charging`;
	}
	if (b.plugged_in) return `${pct} · plugged in`;
	return b.seconds_left ? `${pct} · about ${durationText(b.seconds_left)} left` : pct;
}

/** Focus lengths offered by the calendar panel's Focus row. */
export const FOCUS_MIN = 5;
export const FOCUS_MAX = 180;
export const FOCUS_STEP = 5;

export function stepFocus(minutes: number, dir: 1 | -1): number {
	const next = minutes + dir * FOCUS_STEP;
	return Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, next));
}

/** Timer state the notch broadcasts, so the dock can show a running Focus. */
export interface TimerBroadcast {
	seconds: number;
	running: boolean;
	finished: boolean;
	total: number;
}

export const TIMER_STATE_EVENT = "timer-state";
export const TIMER_STATE_REQUEST_EVENT = "timer-state-request";
export const FOCUS_TIMER_EVENT = "focus-timer";

export type FocusTimerCommand = { action: "start"; seconds: number } | { action: "stop" };

export function countdownText(seconds: number): string {
	const s = Math.max(0, Math.round(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
	return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}
