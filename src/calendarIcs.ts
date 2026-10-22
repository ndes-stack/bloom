// Minimal iCalendar (RFC 5545) reader for the notch calendar.
//
// Handles what Google Calendar's "Secret address in iCal format" feed
// contains in practice: timed and all-day events, time zones (TZID), UTC
// times, DTEND or DURATION, repeating events (RRULE with DAILY / WEEKLY /
// MONTHLY / YEARLY, INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY, BYMONTH,
// BYSETPOS), EXDATE exclusions, single-occurrence edits (RECURRENCE-ID) and
// cancelled events.
//
// Repeats are expanded on "naive" wall-clock times (a timestamp whose UTC
// fields hold the local date and time) and only then converted to real
// instants. That keeps a weekly 10:00 lecture at 10:00 across DST changes.
//
// No Tauri imports here, so this file can be unit-tested outside the app.

export interface CalendarEvent {
	/** Unique per occurrence, safe for React keys. */
	id: string;
	title: string;
	location?: string;
	start: Date;
	/** Exclusive end. Equal to start for zero-length events. */
	end: Date;
	allDay: boolean;
}

export interface ParsedCalendar {
	events: RawEvent[];
}

interface IcsProp {
	name: string;
	params: Record<string, string>;
	value: string;
}

/** A DATE or DATE-TIME value. `tz`: "UTC", an IANA zone, or null for local time. */
interface IcsDate {
	naive: number;
	tz: string | null;
	dateOnly: boolean;
}

interface RawEvent {
	uid: string;
	title: string;
	location?: string;
	start: IcsDate;
	end?: IcsDate;
	durationMs?: number;
	durationDays?: number;
	rrule?: Record<string, string>;
	exdates: Set<number>;
	recurrenceId?: number;
	cancelled: boolean;
}

const DAY_MS = 86_400_000;
const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Safety valve so a malformed rule can never loop forever. */
const MAX_PERIODS = 50_000;

// ── Time zones ──────────────────────────────────────────────────────────

const zoneValidity = new Map<string, boolean>();
const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function isValidTimeZone(tz: string): boolean {
	let ok = zoneValidity.get(tz);
	if (ok === undefined) {
		try {
			new Intl.DateTimeFormat("en-US", { timeZone: tz });
			ok = true;
		} catch {
			ok = false;
		}
		zoneValidity.set(tz, ok);
	}
	return ok;
}

function zoneFormatter(tz: string): Intl.DateTimeFormat {
	let f = zoneFormatters.get(tz);
	if (!f) {
		f = new Intl.DateTimeFormat("en-US", {
			timeZone: tz,
			hourCycle: "h23",
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric"
		});
		zoneFormatters.set(tz, f);
	}
	return f;
}

/** Offset of `tz` from UTC at instant `t`, in ms (positive east of UTC). */
function zoneOffset(tz: string, t: number): number {
	const parts: Record<string, number> = {};
	for (const p of zoneFormatter(tz).formatToParts(new Date(t))) {
		if (p.type !== "literal") parts[p.type] = Number(p.value);
	}
	const asUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour === 24 ? 0 : parts.hour,
		parts.minute,
		parts.second
	);
	return asUtc - (t - (((t % 1000) + 1000) % 1000));
}

/** Converts a naive wall-clock time to a real instant. */
function toInstant(naive: number, tz: string | null, dateOnly: boolean): number {
	const d = new Date(naive);
	if (dateOnly || tz === null) {
		return new Date(
			d.getUTCFullYear(),
			d.getUTCMonth(),
			d.getUTCDate(),
			dateOnly ? 0 : d.getUTCHours(),
			dateOnly ? 0 : d.getUTCMinutes(),
			dateOnly ? 0 : d.getUTCSeconds()
		).getTime();
	}
	if (tz === "UTC") return naive;
	let t = naive - zoneOffset(tz, naive);
	const second = zoneOffset(tz, t);
	if (naive - second !== t) t = naive - second;
	return t;
}

// ── Low-level parsing ───────────────────────────────────────────────────

/** Joins folded lines (continuations start with a space or tab). */
function unfold(text: string): string[] {
	const out: string[] = [];
	for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
		if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
			out[out.length - 1] += line.slice(1);
		} else if (line.length > 0) {
			out.push(line);
		}
	}
	return out;
}

function parseLine(line: string): IcsProp | null {
	// The value starts at the first colon that isn't inside a quoted parameter.
	let inQuotes = false;
	let colon = -1;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === '"') inQuotes = !inQuotes;
		else if (c === ":" && !inQuotes) {
			colon = i;
			break;
		}
	}
	if (colon < 0) return null;
	const head = line.slice(0, colon);
	const value = line.slice(colon + 1);
	const segments = head.split(";");
	const params: Record<string, string> = {};
	for (const seg of segments.slice(1)) {
		const eq = seg.indexOf("=");
		if (eq > 0) params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1).replace(/^"|"$/g, "");
	}
	return { name: segments[0].toUpperCase(), params, value };
}

function unescapeText(v: string): string {
	return v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

function cleanTzid(raw: string | undefined): string | null {
	if (!raw) return null;
	const tz = raw.replace(/^\//, "").trim();
	if (isValidTimeZone(tz)) return tz;
	// "/mozilla.org/20050126_1/Africa/Johannesburg" style prefixes.
	const tail = tz.split("/").slice(-2).join("/");
	return isValidTimeZone(tail) ? tail : null; // Unknown zone: use local time.
}

function parseDate(value: string, params: Record<string, string>): IcsDate | null {
	const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
	if (!m) return null;
	const dateOnly = params.VALUE === "DATE" || m[4] === undefined;
	const naive = Date.UTC(
		+m[1],
		+m[2] - 1,
		+m[3],
		dateOnly ? 0 : +m[4],
		dateOnly ? 0 : +m[5],
		dateOnly ? 0 : +(m[6] ?? 0)
	);
	const tz = dateOnly ? null : m[7] ? "UTC" : cleanTzid(params.TZID);
	return { naive, tz, dateOnly };
}

/** Parses an ISO 8601 duration such as PT1H30M, P1D or P2W. */
function parseDuration(value: string): { ms: number; days: number } | null {
	const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
		value.trim()
	);
	if (!m) return null;
	const sign = m[1] === "-" ? -1 : 1;
	const days = (+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * sign;
	const time = (+(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000 * sign;
	return { ms: days * DAY_MS + time, days };
}

function parseRule(value: string): Record<string, string> {
	const rule: Record<string, string> = {};
	for (const part of value.split(";")) {
		const eq = part.indexOf("=");
		if (eq > 0) rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).toUpperCase();
	}
	return rule;
}

// ── Building events ─────────────────────────────────────────────────────

function buildEvent(props: IcsProp[]): RawEvent | null {
	let start: IcsDate | null = null;
	const ev: Partial<RawEvent> & { exdates: Set<number> } = {
		exdates: new Set(),
		cancelled: false,
		title: "(No title)",
		uid: ""
	};
	for (const p of props) {
		switch (p.name) {
			case "UID":
				ev.uid = p.value.trim();
				break;
			case "SUMMARY":
				ev.title = unescapeText(p.value).trim() || "(No title)";
				break;
			case "LOCATION": {
				const loc = unescapeText(p.value).trim();
				if (loc) ev.location = loc;
				break;
			}
			case "DTSTART":
				start = parseDate(p.value, p.params);
				break;
			case "DTEND":
				ev.end = parseDate(p.value, p.params) ?? undefined;
				break;
			case "DURATION": {
				const d = parseDuration(p.value);
				if (d) {
					ev.durationMs = d.ms;
					ev.durationDays = d.days;
				}
				break;
			}
			case "RRULE":
				ev.rrule = parseRule(p.value);
				break;
			case "EXDATE":
				for (const v of p.value.split(",")) {
					const d = parseDate(v, p.params);
					if (d) ev.exdates.add(toInstant(d.naive, d.tz, d.dateOnly));
				}
				break;
			case "RECURRENCE-ID": {
				const d = parseDate(p.value, p.params);
				if (d) ev.recurrenceId = toInstant(d.naive, d.tz, d.dateOnly);
				break;
			}
			case "STATUS":
				ev.cancelled = p.value.trim().toUpperCase() === "CANCELLED";
				break;
		}
	}
	if (!start) return null;
	return { ...ev, start } as RawEvent;
}

/** Parses iCal text into events. Never throws on bad input; skips what it can't read. */
export function parseIcs(text: string): ParsedCalendar {
	const events: RawEvent[] = [];
	let current: IcsProp[] | null = null;
	let nested = 0; // Depth of components inside a VEVENT (VALARM etc.)

	for (const line of unfold(text)) {
		const prop = parseLine(line);
		if (!prop) continue;
		const value = prop.value.trim().toUpperCase();
		if (prop.name === "BEGIN") {
			if (value === "VEVENT" && current === null) current = [];
			else if (current !== null) nested++;
		} else if (prop.name === "END") {
			if (current !== null && nested > 0) nested--;
			else if (current !== null && value === "VEVENT") {
				const ev = buildEvent(current);
				if (ev) events.push(ev);
				current = null;
			}
		} else if (current !== null && nested === 0) {
			current.push(prop);
		}
	}
	return { events };
}

// ── Repeating events ────────────────────────────────────────────────────

function utcParts(naive: number) {
	const d = new Date(naive);
	return {
		y: d.getUTCFullYear(),
		m: d.getUTCMonth(),
		d: d.getUTCDate(),
		dow: d.getUTCDay(),
		timeOfDay: naive - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
	};
}

function daysInMonth(y: number, m: number): number {
	return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function parseByDay(v: string | undefined): { n: number | null; wd: number }[] {
	if (!v) return [];
	const out: { n: number | null; wd: number }[] = [];
	for (const part of v.split(",")) {
		const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(part.trim());
		if (m) out.push({ n: m[1] ? parseInt(m[1], 10) : null, wd: WEEKDAYS[m[2]] });
	}
	return out;
}

function parseNumList(v: string | undefined): number[] {
	if (!v) return [];
	return v
		.split(",")
		.map((s) => parseInt(s, 10))
		.filter((n) => !Number.isNaN(n) && n !== 0);
}

/** Days (1-based) in a month matching BYDAY entries like MO, 2TU, -1FR. */
function monthDaysForByDay(y: number, m: number, byDay: { n: number | null; wd: number }[]): number[] {
	const total = daysInMonth(y, m);
	const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
	const days = new Set<number>();
	for (const { n, wd } of byDay) {
		const first = 1 + ((wd - firstDow + 7) % 7);
		const all: number[] = [];
		for (let d = first; d <= total; d += 7) all.push(d);
		if (n === null) all.forEach((d) => days.add(d));
		else {
			const pick = n > 0 ? all[n - 1] : all[all.length + n];
			if (pick !== undefined) days.add(pick);
		}
	}
	return [...days].sort((a, b) => a - b);
}

function monthDaysForByMonthDay(y: number, m: number, list: number[]): number[] {
	const total = daysInMonth(y, m);
	return list
		.map((n) => (n > 0 ? n : total + n + 1))
		.filter((d) => d >= 1 && d <= total)
		.sort((a, b) => a - b);
}

function applySetPos(sorted: number[], setPos: number[]): number[] {
	if (setPos.length === 0) return sorted;
	const out: number[] = [];
	for (const p of setPos) {
		const v = p > 0 ? sorted[p - 1] : sorted[sorted.length + p];
		if (v !== undefined) out.push(v);
	}
	return [...new Set(out)].sort((a, b) => a - b);
}

/** Candidate naive start times for period k of a rule, in ascending order. */
function periodCandidates(
	rule: Record<string, string>,
	startNaive: number,
	k: number
): { candidates: number[]; periodStart: number } | null {
	const s = utcParts(startNaive);
	const interval = Math.max(1, parseInt(rule.INTERVAL ?? "1", 10) || 1);
	const byDay = parseByDay(rule.BYDAY);
	const byMonthDay = parseNumList(rule.BYMONTHDAY);
	const byMonth = parseNumList(rule.BYMONTH).map((n) => n - 1);
	const setPos = parseNumList(rule.BYSETPOS);
	const at = (y: number, m: number, d: number) => Date.UTC(y, m, d) + s.timeOfDay;

	switch (rule.FREQ) {
		case "DAILY": {
			const base = Date.UTC(s.y, s.m, s.d + k * interval) + s.timeOfDay;
			const p = utcParts(base);
			const dayOk = byDay.length === 0 || byDay.some((b) => b.wd === p.dow);
			const monthOk = byMonth.length === 0 || byMonth.includes(p.m);
			return { candidates: dayOk && monthOk ? [base] : [], periodStart: base };
		}
		case "WEEKLY": {
			const wkst = WEEKDAYS[rule.WKST ?? "MO"] ?? 1;
			const weekStart = Date.UTC(s.y, s.m, s.d - ((s.dow - wkst + 7) % 7) + k * interval * 7);
			const wds = byDay.length > 0 ? byDay.map((b) => b.wd) : [s.dow];
			const candidates = [...new Set(wds)]
				.map((wd) => weekStart + ((wd - wkst + 7) % 7) * DAY_MS + s.timeOfDay)
				.filter((c) => byMonth.length === 0 || byMonth.includes(utcParts(c).m))
				.sort((a, b) => a - b);
			return { candidates, periodStart: weekStart };
		}
		case "MONTHLY": {
			const monthIndex = s.m + k * interval;
			const y = s.y + Math.floor(monthIndex / 12);
			const m = ((monthIndex % 12) + 12) % 12;
			let days: number[];
			if (byDay.length > 0) {
				days = monthDaysForByDay(y, m, byDay);
				if (byMonthDay.length > 0) {
					const allowed = new Set(monthDaysForByMonthDay(y, m, byMonthDay));
					days = days.filter((d) => allowed.has(d));
				}
			} else if (byMonthDay.length > 0) days = monthDaysForByMonthDay(y, m, byMonthDay);
			else days = s.d <= daysInMonth(y, m) ? [s.d] : [];
			days = applySetPos(days, setPos);
			const ok = byMonth.length === 0 || byMonth.includes(m);
			return { candidates: ok ? days.map((d) => at(y, m, d)) : [], periodStart: Date.UTC(y, m, 1) };
		}
		case "YEARLY": {
			const y = s.y + k * interval;
			const months = byMonth.length > 0 ? byMonth : [s.m];
			const candidates: number[] = [];
			for (const m of months) {
				let days: number[];
				if (byDay.length > 0) days = monthDaysForByDay(y, m, byDay);
				else if (byMonthDay.length > 0) days = monthDaysForByMonthDay(y, m, byMonthDay);
				else days = s.d <= daysInMonth(y, m) ? [s.d] : [];
				for (const d of days) candidates.push(at(y, m, d));
			}
			candidates.sort((a, b) => a - b);
			return { candidates: applySetPos(candidates, setPos), periodStart: Date.UTC(y, 0, 1) };
		}
		default:
			return null;
	}
}

/** Naive start times of every occurrence that begins before `rangeEnd`. */
function expandStarts(ev: RawEvent, rangeEnd: number): number[] {
	const rule = ev.rrule;
	const { naive, tz, dateOnly } = ev.start;
	if (!rule || !rule.FREQ) return [naive];

	const count = rule.COUNT ? parseInt(rule.COUNT, 10) : Infinity;
	let until = Infinity;
	if (rule.UNTIL) {
		const u = parseDate(rule.UNTIL, {});
		if (u) {
			until = u.dateOnly
				? toInstant(u.naive + DAY_MS - 1000, dateOnly ? null : tz, false)
				: toInstant(u.naive, u.tz ?? tz, false);
		}
	}
	// Naive times can be up to ~14h away from instants; leave room either side.
	const lastPeriodNaive = rangeEnd + 2 * DAY_MS;

	const out: number[] = [];
	let produced = 0;
	for (let k = 0; k < MAX_PERIODS; k++) {
		const period = periodCandidates(rule, naive, k);
		if (!period) return [naive]; // Unknown FREQ: show the first occurrence only.
		if (period.periodStart > lastPeriodNaive) break;
		for (const c of period.candidates) {
			if (c < naive) continue;
			const instant = toInstant(c, tz, dateOnly);
			if (instant > until || produced >= count) return out;
			produced++;
			if (instant >= rangeEnd) return out;
			out.push(c);
		}
	}
	return out;
}

function occurrenceEnd(ev: RawEvent, startNaive: number): number {
	const { tz, dateOnly } = ev.start;
	if (ev.end) {
		if (dateOnly || ev.end.tz === tz) {
			const span = ev.end.naive - ev.start.naive;
			return toInstant(startNaive + Math.max(0, span), tz, dateOnly);
		}
		const span =
			toInstant(ev.end.naive, ev.end.tz, ev.end.dateOnly) - toInstant(ev.start.naive, tz, dateOnly);
		return toInstant(startNaive, tz, dateOnly) + Math.max(0, span);
	}
	if (ev.durationMs !== undefined) {
		if (dateOnly) return toInstant(startNaive + Math.max(0, ev.durationDays ?? 0) * DAY_MS, tz, true);
		return toInstant(startNaive, tz, false) + Math.max(0, ev.durationMs);
	}
	return dateOnly ? toInstant(startNaive + DAY_MS, tz, true) : toInstant(startNaive, tz, false);
}

/** All event occurrences that overlap [rangeStart, rangeEnd). */
export function eventsInRange(cal: ParsedCalendar, rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
	const from = rangeStart.getTime();
	const to = rangeEnd.getTime();

	// Occurrences replaced by an edited copy (RECURRENCE-ID) are skipped in the series.
	const replaced = new Map<string, Set<number>>();
	for (const ev of cal.events) {
		if (ev.recurrenceId === undefined) continue;
		if (!replaced.has(ev.uid)) replaced.set(ev.uid, new Set());
		replaced.get(ev.uid)!.add(ev.recurrenceId);
	}

	const out: CalendarEvent[] = [];
	for (const ev of cal.events) {
		if (ev.cancelled) continue;
		const isOverride = ev.recurrenceId !== undefined;
		const skip = isOverride ? undefined : replaced.get(ev.uid);
		const starts = isOverride ? [ev.start.naive] : expandStarts(ev, to);
		for (const s of starts) {
			const start = toInstant(s, ev.start.tz, ev.start.dateOnly);
			if (!isOverride && (ev.exdates.has(start) || skip?.has(start))) continue;
			const end = occurrenceEnd(ev, s);
			const overlaps = end > from ? start < to : end === start && start >= from && start < to;
			if (!overlaps) continue;
			out.push({
				id: `${ev.uid || ev.title}@${start}`,
				title: ev.title,
				location: ev.location,
				start: new Date(start),
				end: new Date(end),
				allDay: ev.start.dateOnly
			});
		}
	}
	return out;
}

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
	if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
	return a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title);
}

/**
 * Events for `count` consecutive local days starting on `start`'s date, one
 * sorted list per day. Multi-day events appear on every day they touch.
 */
export function eventsForDays(cal: ParsedCalendar, start: Date, count: number): CalendarEvent[][] {
	const y = start.getFullYear();
	const m = start.getMonth();
	const d0 = start.getDate();
	const days: CalendarEvent[][] = Array.from({ length: count }, () => []);
	const bounds = Array.from({ length: count + 1 }, (_, i) => new Date(y, m, d0 + i).getTime());

	for (const ev of eventsInRange(cal, new Date(bounds[0]), new Date(bounds[count]))) {
		const s = ev.start.getTime();
		const e = ev.end.getTime();
		for (let i = 0; i < count; i++) {
			const hit = e > s ? s < bounds[i + 1] && e > bounds[i] : s >= bounds[i] && s < bounds[i + 1];
			if (hit) days[i].push(ev);
		}
	}
	for (const list of days) list.sort(compareEvents);
	return days;
}

/** Events for each day (1-based) of a month, in local time, sorted for display. */
export function eventsByDay(cal: ParsedCalendar, year: number, month: number): Map<number, CalendarEvent[]> {
	const total = new Date(year, month + 1, 0).getDate();
	const byDay = new Map<number, CalendarEvent[]>();
	eventsForDays(cal, new Date(year, month, 1), total).forEach((list, i) => {
		if (list.length > 0) byDay.set(i + 1, list);
	});
	return byDay;
}

/** Tests, exams and similar get a stronger highlight in the calendar. */
export function isImportantEvent(ev: CalendarEvent): boolean {
	return /\b(test|exam|examination|quiz|assessment|presentation|deadline|due)\b/i.test(ev.title);
}

/** "All day", "09:00 – 10:30", "Until 11:00" or "From 22:00", relative to one day. */
export function describeEventTime(ev: CalendarEvent, day: Date): string {
	if (ev.allDay) return "All day";
	const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
	const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
	const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	const startsToday = ev.start.getTime() >= dayStart;
	const endsToday = ev.end.getTime() <= dayEnd;
	if (startsToday && endsToday) {
		return ev.end.getTime() > ev.start.getTime() ? `${fmt(ev.start)} – ${fmt(ev.end)}` : fmt(ev.start);
	}
	if (!startsToday && endsToday) return `Until ${fmt(ev.end)}`;
	if (startsToday) return `From ${fmt(ev.start)}`;
	return "All day";
}
