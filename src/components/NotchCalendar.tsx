import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, ChevronLeft, ChevronRight, Columns3, LayoutGrid, List } from "lucide-react";
import { useCalendarDays, useCalendarEvents } from "../hooks/useCalendarEvents";
import { isImportantEvent, type CalendarEvent } from "../calendarIcs";

// ── Views ───────────────────────────────────────────────────────────────

export type CalendarViewMode = "month" | "agenda" | "columns" | "grid";
export const CALENDAR_VIEW_KEY = "bloom-calendar-view";

const VIEW_OPTIONS: { mode: CalendarViewMode; label: string; Icon: typeof List }[] = [
	{ mode: "month", label: "Month", Icon: LayoutGrid },
	{ mode: "agenda", label: "Week: day list", Icon: List },
	{ mode: "columns", label: "Week: columns", Icon: Columns3 },
	{ mode: "grid", label: "Week: timetable", Icon: CalendarClock }
];

export function parseCalendarView(value: unknown): CalendarViewMode {
	return value === "agenda" || value === "columns" || value === "grid" ? value : "month";
}

/** Week rows a month occupies (4 to 6). The month view sizes itself from this. */
export function monthRowCount(year: number, month: number): number {
	const firstWeekday = new Date(year, month, 1).getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	return Math.ceil((firstWeekday + daysInMonth) / 7);
}

/** Monday of the week containing `d`. Week views run Monday to Sunday. */
export function startOfWeek(d: Date): Date {
	const offset = (d.getDay() + 6) % 7;
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
}

// Heights of each view's body (below the 36px notch bar and the header).
const PANEL_CHROME = 36 + 12 + 34 + 14; // notch bar, top padding, header, bottom padding
const AGENDA_LIST_ROWS = 3;
const AGENDA_ROW_H = 42;
const AGENDA_BODY = 50 + 10 + AGENDA_ROW_H * AGENDA_LIST_ROWS;
const COLUMNS_BODY = 186;
const GRID_HEAD = 16;
const GRID_BODY_H = 176;
const GRID_BODY = GRID_HEAD + 4 + GRID_BODY_H;

/** Full notch height for a calendar view, so the panel never clips or jumps. */
export function calendarPanelHeight(view: CalendarViewMode, date: Date): number {
	switch (view) {
		case "agenda":
			return PANEL_CHROME + AGENDA_BODY;
		case "columns":
			return PANEL_CHROME + COLUMNS_BODY;
		case "grid":
			return PANEL_CHROME + GRID_BODY;
		default:
			return 36 + 76 + monthRowCount(date.getFullYear(), date.getMonth()) * 47;
	}
}

// ── Shared bits ─────────────────────────────────────────────────────────

/** "14:30" or "2:30p": short enough to sit in front of a title. */
function shortTime(d: Date, use24h: boolean): string {
	const m = d.getMinutes().toString().padStart(2, "0");
	if (use24h) return `${d.getHours()}:${m}`;
	const h = d.getHours() % 12 || 12;
	return `${h}:${m}${d.getHours() < 12 ? "a" : "p"}`;
}

function sameDay(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function startsOn(ev: CalendarEvent, day: Date): boolean {
	return sameDay(ev.start, day);
}

/** "08:30" / "8:30 AM", following the user's 12/24-hour clock setting. */
function clock(d: Date, use24h: boolean): string {
	const m = d.getMinutes().toString().padStart(2, "0");
	if (use24h) return `${d.getHours().toString().padStart(2, "0")}:${m}`;
	return `${d.getHours() % 12 || 12}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

/** An event's time on one day: "08:30 – 10:20", "All day", "Until 01:00", "From 23:00". */
function timeRange(ev: CalendarEvent, day: Date, use24h: boolean): string {
	if (ev.allDay) return "All day";
	const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
	const dayEnd = addDays(dayStart, 1);
	const startsToday = ev.start >= dayStart;
	const endsToday = ev.end <= dayEnd;
	if (startsToday && endsToday) {
		return ev.end > ev.start ? `${clock(ev.start, use24h)} – ${clock(ev.end, use24h)}` : clock(ev.start, use24h);
	}
	if (endsToday) return `Until ${clock(ev.end, use24h)}`;
	if (startsToday) return `From ${clock(ev.start, use24h)}`;
	return "All day";
}

/** "in 25 min", "in 3 h 10 min", "in 2 days". */
function timeUntil(target: Date, now: Date): string {
	const mins = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
	if (mins < 60) return `in ${mins} min`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `in ${hours} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
	const days = Math.round(hours / 24);
	return `in ${days} day${days === 1 ? "" : "s"}`;
}

// Period flip: the new month/week slides in from the side you're moving
// towards while the old one slides out the other way.
const periodSlide = {
	enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
	center: { x: 0, opacity: 1 },
	exit: (dir: number) => ({ x: dir * -48, opacity: 0 })
};
const periodTransition = {
	x: { type: "spring" as const, stiffness: 420, damping: 38 },
	opacity: { duration: 0.16 }
};

// ── Hover popup ─────────────────────────────────────────────────────────

const POPUP_WIDTH = 220;
const POPUP_MAX_EVENTS = 5;

interface PopupState {
	key: string;
	date: Date;
	events: CalendarEvent[];
	left: number;
	top?: number;
	bottom?: number;
	maxHeight: number;
}

/**
 * Popup listing one day's events, positioned inside the calendar panel (the
 * notch clips anything outside it): below the hovered element, or above it
 * when it sits in the lower half.
 */
function useDayPopup(use24h: boolean) {
	const [popup, setPopup] = useState<PopupState | null>(null);

	const show = (key: string, el: HTMLElement, date: Date, events: CalendarEvent[]) => {
		if (events.length === 0) {
			setPopup(null);
			return;
		}
		const panel = el.closest(".calendar-timer-content") as HTMLElement | null;
		if (!panel) return;
		const p = panel.getBoundingClientRect();
		const c = el.getBoundingClientRect();
		// The notch applies the Scale setting as CSS zoom: rects come back zoomed
		// while `left`/`top` are unzoomed CSS px, so convert.
		const cssWidth = parseFloat(getComputedStyle(panel).width);
		const zoom = cssWidth > 0 ? p.width / cssWidth : 1;
		const panelW = p.width / zoom;
		const panelH = p.height / zoom;
		const cellLeft = (c.left - p.left) / zoom;
		const cellTop = (c.top - p.top) / zoom;
		const cellW = c.width / zoom;
		const cellH = c.height / zoom;
		const margin = 6;
		// Tall targets (week columns) leave no room above or below: sit beside them.
		if (cellH > panelH * 0.4) {
			const right = cellLeft + cellW + 6;
			const left = right + POPUP_WIDTH <= panelW - margin ? right : Math.max(margin, cellLeft - POPUP_WIDTH - 6);
			setPopup({ key, date, events, left, top: cellTop, maxHeight: panelH - cellTop - margin });
			return;
		}
		const centered = cellLeft + cellW / 2 - POPUP_WIDTH / 2;
		const left = Math.max(margin, Math.min(centered, panelW - POPUP_WIDTH - margin));
		const above = cellTop + cellH / 2 > panelH / 2;
		setPopup({
			key,
			date,
			events,
			left,
			...(above
				? { bottom: panelH - cellTop + 4, maxHeight: cellTop - 4 - margin }
				: { top: cellTop + cellH + 4, maxHeight: panelH - cellTop - cellH - 4 - margin })
		});
	};
	const hide = (key: string) => setPopup((cur) => (cur?.key === key ? null : cur));
	const clear = () => setPopup(null);

	const view = (
		<AnimatePresence>
			{popup && (
				<motion.div
					key={popup.key}
					className="calendar-event-popup"
					style={{
						left: popup.left,
						top: popup.top,
						bottom: popup.bottom,
						width: POPUP_WIDTH,
						maxHeight: popup.maxHeight
					}}
					initial={{ opacity: 0, y: popup.top !== undefined ? -3 : 3 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, transition: { duration: 0.08 } }}
					transition={{ duration: 0.12 }}
				>
					<div className="calendar-event-popup-date">
						{popup.date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
					</div>
					{popup.events.slice(0, POPUP_MAX_EVENTS).map((ev) => (
						<div key={ev.id} className={`calendar-event-row ${isImportantEvent(ev) ? "important" : ""}`}>
							<span className="calendar-event-bar" />
							<div className="calendar-event-text">
								<div className="calendar-event-title">{ev.title}</div>
								<div className="calendar-event-meta">
									{timeRange(ev, popup.date, use24h)}
									{ev.location ? ` · ${ev.location}` : ""}
								</div>
							</div>
						</div>
					))}
					{popup.events.length > POPUP_MAX_EVENTS && (
						<div className="calendar-event-more">+{popup.events.length - POPUP_MAX_EVENTS} more</div>
					)}
				</motion.div>
			)}
		</AnimatePresence>
	);

	return { show, hide, clear, view };
}

type DayPopupApi = ReturnType<typeof useDayPopup>;

// ── Component ───────────────────────────────────────────────────────────

interface NotchCalendarProps {
	view: CalendarViewMode;
	onViewChange: (view: CalendarViewMode) => void;
	/** Any date inside the month or week being shown. */
	date: Date;
	/** Move back (-1) or forward (+1) one month or week. */
	onShift: (delta: number) => void;
	onToday: () => void;
	use24h: boolean;
	/** Rendered at the right end of the header (the Calendar/Timer switch). */
	headerExtra?: ReactNode;
}

export function NotchCalendar({
	view,
	onViewChange,
	date,
	onShift,
	onToday,
	use24h,
	headerExtra
}: NotchCalendarProps) {
	const popup = useDayPopup(use24h);
	const now = new Date();
	const isMonth = view === "month";
	const weekStart = startOfWeek(date);

	// The period on screen, as a number that grows with time (for the slide direction).
	const periodIndex = isMonth
		? date.getFullYear() * 12 + date.getMonth()
		: Math.round(weekStart.getTime() / (7 * 86_400_000));
	const periodKey = `${view}-${periodIndex}`;
	const lastPeriod = useRef(periodIndex);
	const direction = periodIndex >= lastPeriod.current ? 1 : -1;
	useEffect(() => {
		lastPeriod.current = periodIndex;
	}, [periodIndex]);

	const showsToday = isMonth
		? now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth()
		: now >= weekStart && now < addDays(weekStart, 7);

	const title = isMonth
		? `${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`
		: weekTitle(weekStart);

	const shift = (delta: number) => {
		popup.clear();
		onShift(delta);
	};

	return (
		<div className="calendar-container wide">
			<div className="calendar-header">
				<div className="calendar-month-nav">
					<button
						className="calendar-nav-btn"
						onClick={() => shift(-1)}
						title={isMonth ? "Previous month" : "Previous week"}
						aria-label={isMonth ? "Previous month" : "Previous week"}
					>
						<ChevronLeft size={14} strokeWidth={2.5} />
					</button>
					<span className="month-year">{title}</span>
					<button
						className="calendar-nav-btn"
						onClick={() => shift(1)}
						title={isMonth ? "Next month" : "Next week"}
						aria-label={isMonth ? "Next month" : "Next week"}
					>
						<ChevronRight size={14} strokeWidth={2.5} />
					</button>
					{!showsToday && (
						<button className="calendar-today-btn" onClick={() => (popup.clear(), onToday())}>
							Today
						</button>
					)}
				</div>
				<div className="calendar-header-right">
					<div className="calendar-view-picker" role="radiogroup" aria-label="Calendar layout">
						{VIEW_OPTIONS.map(({ mode, label, Icon }) => (
							<button
								key={mode}
								role="radio"
								aria-checked={view === mode}
								aria-label={label}
								title={label}
								className={view === mode ? "active" : ""}
								onClick={() => {
									popup.clear();
									onViewChange(mode);
								}}
							>
								<Icon size={13} strokeWidth={2.2} />
							</button>
						))}
					</div>
					{headerExtra}
				</div>
			</div>

			<div className="calendar-body">
				<div className="calendar-period-viewport">
					<AnimatePresence initial={false} custom={direction} mode="popLayout">
						<motion.div
							key={periodKey}
							className="calendar-period"
							custom={direction}
							variants={periodSlide}
							initial="enter"
							animate="center"
							exit="exit"
							transition={periodTransition}
						>
							{isMonth ? (
								<MonthView date={date} use24h={use24h} popup={popup} />
							) : view === "agenda" ? (
								<AgendaWeek weekStart={weekStart} use24h={use24h} />
							) : view === "columns" ? (
								<ColumnsWeek weekStart={weekStart} use24h={use24h} popup={popup} />
							) : (
								<GridWeek weekStart={weekStart} use24h={use24h} popup={popup} />
							)}
						</motion.div>
					</AnimatePresence>
				</div>
			</div>

			{popup.view}
		</div>
	);
}

/** "19 – 25 Oct", or "28 Sep – 4 Oct" across months. */
function weekTitle(weekStart: Date): string {
	const end = addDays(weekStart, 6);
	const month = (d: Date) => d.toLocaleString("default", { month: "short" });
	return weekStart.getMonth() === end.getMonth()
		? `${weekStart.getDate()} – ${end.getDate()} ${month(end)}`
		: `${weekStart.getDate()} ${month(weekStart)} – ${end.getDate()} ${month(end)}`;
}

// ── Month view ──────────────────────────────────────────────────────────

/** Event names shown inside a day box before switching to "+N more". */
const MAX_CHIPS = 2;

function MonthView({ date, use24h, popup }: { date: Date; use24h: boolean; popup: DayPopupApi }) {
	const year = date.getFullYear();
	const month = date.getMonth();
	const { byDay } = useCalendarEvents(year, month);
	const now = new Date();
	const isCurrentMonth = now.getMonth() === month && now.getFullYear() === year;
	const today = now.getDate();
	const totalDays = new Date(year, month + 1, 0).getDate();
	const startDay = new Date(year, month, 1).getDay();

	const cells = [];
	for (let i = 0; i < startDay; i++) cells.push(<div key={`empty-${i}`} className="calendar-day empty" />);
	for (let i = 1; i <= totalDays; i++) {
		const events = byDay.get(i) ?? [];
		const dayDate = new Date(year, month, i);
		const key = `m-${year}-${month}-${i}`;
		const classes = ["calendar-day"];
		if (isCurrentMonth && i === today) classes.push("today");
		if (events.length > 0) classes.push("has-events");
		if (isCurrentMonth && i < today) classes.push("past");
		// Leave room for the "+N more" line when the chips can't fit them all.
		const chipCount = events.length > MAX_CHIPS ? MAX_CHIPS - 1 : events.length;
		cells.push(
			<div
				key={i}
				className={classes.join(" ")}
				onMouseEnter={(e) => popup.show(key, e.currentTarget, dayDate, events)}
				onMouseLeave={() => popup.hide(key)}
			>
				<span className="calendar-day-number">{i}</span>
				{events.length > 0 && (
					<span className="calendar-day-chips">
						{events.slice(0, chipCount).map((ev) => (
							<EventChip key={ev.id} ev={ev} day={dayDate} use24h={use24h} />
						))}
						{events.length > chipCount && (
							<span className="calendar-chip-more">+{events.length - chipCount} more</span>
						)}
					</span>
				)}
			</div>
		);
	}

	return (
		<>
			<div className="calendar-weekdays">
				{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
					<div key={d} className="day-name">
						{d}
					</div>
				))}
			</div>
			<div className="calendar-grid">{cells}</div>
		</>
	);
}

function EventChip({ ev, day, use24h }: { ev: CalendarEvent; day: Date; use24h: boolean }) {
	const showTime = !ev.allDay && startsOn(ev, day);
	const kind = ev.allDay ? "all-day" : "timed";
	return (
		<span className={`calendar-chip ${kind} ${isImportantEvent(ev) ? "important" : ""}`}>
			{showTime && <span className="calendar-chip-time">{shortTime(ev.start, use24h)}</span>}
			<span className="calendar-chip-title">{ev.title}</span>
		</span>
	);
}

// ── Week A: day strip + agenda ──────────────────────────────────────────

function AgendaWeek({ weekStart, use24h }: { weekStart: Date; use24h: boolean }) {
	// Two weeks of data so "Up next" can look past the end of this week.
	const { days } = useCalendarDays(weekStart, 14);
	const now = new Date();
	const todayIndex = Math.floor((now.getTime() - weekStart.getTime()) / 86_400_000);
	const defaultIndex = todayIndex >= 0 && todayIndex < 7 ? todayIndex : 0;
	const [selected, setSelected] = useState(defaultIndex);
	useEffect(() => setSelected(defaultIndex), [weekStart.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

	const selectedDate = addDays(weekStart, selected);
	const events = days[selected] ?? [];
	const isToday = selected === todayIndex;
	const remainingToday = events.filter((ev) => ev.end > now);

	// After today's last event, point at the next thing coming up.
	const upNext = useMemo(() => {
		if (!isToday || remainingToday.length > 0) return null;
		for (let i = selected + 1; i < days.length; i++) {
			const next = days[i].find((ev) => ev.start > now);
			if (next) return next;
		}
		return null;
	}, [isToday, remainingToday.length, selected, days]); // eslint-disable-line react-hooks/exhaustive-deps

	const formatRange = (ev: CalendarEvent) => timeRange(ev, selectedDate, use24h);

	return (
		<div className="week-agenda">
			<div className="week-strip">
				{Array.from({ length: 7 }, (_, i) => {
					const d = addDays(weekStart, i);
					const dayEvents = days[i] ?? [];
					const classes = ["week-strip-day"];
					if (i === selected) classes.push("selected");
					if (i === todayIndex) classes.push("today");
					if (todayIndex >= 0 && i < todayIndex && todayIndex < 7) classes.push("past");
					return (
						<button
							key={i}
							className={classes.join(" ")}
							aria-pressed={i === selected}
							onClick={() => setSelected(i)}
						>
							<span className="week-strip-name">
								{i === todayIndex ? "Today" : d.toLocaleDateString([], { weekday: "short" })}
							</span>
							<span className="week-strip-date">{d.getDate()}</span>
							<span className="week-strip-dots" aria-hidden="true">
								{dayEvents.slice(0, 3).map((ev) => (
									<span key={ev.id} className={isImportantEvent(ev) ? "important" : ""} />
								))}
							</span>
						</button>
					);
				})}
			</div>

			<div className="week-agenda-list" style={{ height: AGENDA_ROW_H * AGENDA_LIST_ROWS }}>
				{events.map((ev) => {
					const finished = ev.end <= now;
					const ongoing = !finished && ev.start <= now;
					return (
						<div
							key={ev.id}
							className={`week-agenda-row ${finished ? "finished" : ""} ${ongoing ? "ongoing" : ""} ${isImportantEvent(ev) ? "important" : ""}`}
						>
							<span className="week-agenda-time">{formatRange(ev)}</span>
							<span className="week-agenda-bar" />
							<span className="week-agenda-text">
								<span className="week-agenda-title">{ev.title}</span>
								<span className="week-agenda-meta">
									{[ev.location, finished ? "finished" : ongoing ? "now" : null]
										.filter(Boolean)
										.join(" · ")}
								</span>
							</span>
						</div>
					);
				})}
				{upNext && (
					<div className={`week-agenda-row up-next ${isImportantEvent(upNext) ? "important" : ""}`}>
						<span className="week-agenda-time">Up next</span>
						<span className="week-agenda-bar" />
						<span className="week-agenda-text">
							<span className="week-agenda-title">{upNext.title}</span>
							<span className="week-agenda-meta">
								{upNext.start.toLocaleDateString([], { weekday: "short" })}{" "}
								{upNext.allDay ? "all day" : shortTime(upNext.start, use24h)} ·{" "}
								{timeUntil(upNext.start, now)}
							</span>
						</span>
					</div>
				)}
				{events.length === 0 && !upNext && (
					<div className="week-agenda-empty">
						Nothing on {selectedDate.toLocaleDateString([], { weekday: "long" })}
					</div>
				)}
			</div>
		</div>
	);
}

// ── Week B: seven columns ───────────────────────────────────────────────

const COLUMN_MAX_CHIPS = 4;

function ColumnsWeek({ weekStart, use24h, popup }: { weekStart: Date; use24h: boolean; popup: DayPopupApi }) {
	const { days } = useCalendarDays(weekStart, 7);
	const now = new Date();
	return (
		<div className="week-columns" style={{ height: COLUMNS_BODY }}>
			{days.map((events, i) => {
				const d = addDays(weekStart, i);
				const key = `c-${d.getTime()}`;
				const isToday = sameDay(d, now);
				const isPast = !isToday && d < now;
				const chipCount = events.length > COLUMN_MAX_CHIPS ? COLUMN_MAX_CHIPS - 1 : events.length;
				return (
					<div
						key={key}
						className={`week-column ${isToday ? "today" : ""} ${isPast ? "past" : ""}`}
						onMouseEnter={(e) => popup.show(key, e.currentTarget, d, events)}
						onMouseLeave={() => popup.hide(key)}
					>
						<div className="week-column-head">
							<span>{d.toLocaleDateString([], { weekday: "short" })}</span>
							<strong>{d.getDate()}</strong>
						</div>
						{events.slice(0, chipCount).map((ev) => (
							<div
								key={ev.id}
								className={`week-column-chip ${ev.allDay ? "all-day" : ""} ${isImportantEvent(ev) ? "important" : ""} ${ev.end <= now ? "finished" : ""}`}
							>
								<span className="week-column-time">
									{ev.allDay ? "All day" : startsOn(ev, d) ? shortTime(ev.start, use24h) : "cont."}
								</span>
								<span className="week-column-title">{ev.title}</span>
							</div>
						))}
						{events.length > chipCount && (
							<div className="week-column-more">+{events.length - chipCount} more</div>
						)}
						{events.length === 0 && <div className="week-column-free">Free</div>}
					</div>
				);
			})}
		</div>
	);
}

// ── Week C: timetable grid ──────────────────────────────────────────────

interface PlacedBlock {
	ev: CalendarEvent;
	top: number;
	height: number;
	lane: number;
	lanes: number;
}

function GridWeek({ weekStart, use24h, popup }: { weekStart: Date; use24h: boolean; popup: DayPopupApi }) {
	const { days } = useCalendarDays(weekStart, 7);
	const now = new Date();

	// Hour range: fit this week's timed events, at least 08:00–18:00.
	const { fromHour, toHour } = useMemo(() => {
		let from = 8;
		let to = 18;
		days.forEach((events, i) => {
			const dayStart = addDays(weekStart, i).getTime();
			for (const ev of events) {
				if (ev.allDay) continue;
				const s = Math.max(0, (ev.start.getTime() - dayStart) / 3_600_000);
				const e = Math.min(24, (ev.end.getTime() - dayStart) / 3_600_000);
				from = Math.min(from, Math.floor(s));
				to = Math.max(to, Math.ceil(Math.max(e, s + 0.5)));
			}
		});
		return { fromHour: Math.max(0, from), toHour: Math.min(24, to) };
	}, [days, weekStart]);
	const span = toHour - fromHour;
	const hasAllDay = days.some((list) => list.some((ev) => ev.allDay));
	const allDayRow = hasAllDay ? 14 : 0;
	const pxPerHour = (GRID_BODY_H - allDayRow) / span;
	const labelEvery = span > 12 ? 3 : 2;

	const placed = days.map((events, i) => {
		const dayStart = addDays(weekStart, i).getTime();
		const timed = events
			.filter((ev) => !ev.allDay)
			.map((ev) => {
				const s = Math.max(fromHour, (ev.start.getTime() - dayStart) / 3_600_000);
				const e = Math.min(toHour, Math.max((ev.end.getTime() - dayStart) / 3_600_000, s + 0.25));
				return { ev, s, e };
			})
			.sort((a, b) => a.s - b.s);
		// Side-by-side lanes for overlapping events.
		const laneEnds: number[] = [];
		const blocks: PlacedBlock[] = timed.map(({ ev, s, e }) => {
			let lane = laneEnds.findIndex((end) => end <= s);
			if (lane === -1) {
				lane = laneEnds.length;
				laneEnds.push(e);
			} else laneEnds[lane] = e;
			return {
				ev,
				top: allDayRow + (s - fromHour) * pxPerHour,
				height: Math.max(9, (e - s) * pxPerHour - 1),
				lane,
				lanes: 1
			};
		});
		const lanes = Math.max(1, laneEnds.length);
		blocks.forEach((b) => (b.lanes = lanes));
		return { allDay: events.filter((ev) => ev.allDay), blocks };
	});

	const nowHour = now.getHours() + now.getMinutes() / 60;

	return (
		<div className="week-grid">
			<div className="week-grid-head" style={{ height: GRID_HEAD }}>
				<span />
				{Array.from({ length: 7 }, (_, i) => {
					const d = addDays(weekStart, i);
					return (
						<span key={i} className={sameDay(d, now) ? "today" : d < now ? "past" : ""}>
							{d.toLocaleDateString([], { weekday: "short" })} {d.getDate()}
						</span>
					);
				})}
			</div>
			<div className="week-grid-body" style={{ height: GRID_BODY_H }}>
				<div className="week-grid-hours">
					{Array.from({ length: Math.floor(span / labelEvery) + 1 }, (_, k) => {
						const h = fromHour + k * labelEvery;
						if (h >= toHour) return null;
						return (
							<span key={h} style={{ top: allDayRow + (h - fromHour) * pxPerHour - 5 }}>
								{use24h ? `${String(h).padStart(2, "0")}:00` : `${h % 12 || 12}${h < 12 ? "am" : "pm"}`}
							</span>
						);
					})}
				</div>
				{placed.map(({ allDay, blocks }, i) => {
					const d = addDays(weekStart, i);
					const key = `g-${d.getTime()}`;
					const isToday = sameDay(d, now);
					return (
						<div
							key={key}
							className={`week-grid-day ${isToday ? "today" : ""} ${!isToday && d < now ? "past" : ""}`}
							onMouseEnter={(e) => popup.show(key, e.currentTarget, d, days[i])}
							onMouseLeave={() => popup.hide(key)}
						>
							{allDay.slice(0, 1).map((ev) => (
								<div key={ev.id} className={`week-grid-allday ${isImportantEvent(ev) ? "important" : ""}`}>
									{allDay.length > 1 ? `${allDay.length} all-day` : ev.title}
								</div>
							))}
							{blocks.map((b) => (
								<div
									key={b.ev.id}
									className={`week-grid-block ${isImportantEvent(b.ev) ? "important" : ""} ${b.ev.end <= now ? "finished" : ""}`}
									style={{
										top: b.top,
										height: b.height,
										left: `calc(${(b.lane / b.lanes) * 100}% + 2px)`,
										width: `calc(${100 / b.lanes}% - 4px)`
									}}
								>
									<span className="week-grid-block-title">{b.ev.title}</span>
									{b.height >= 24 && (
										<span className="week-grid-block-time">{shortTime(b.ev.start, use24h)}</span>
									)}
								</div>
							))}
							{isToday && nowHour >= fromHour && nowHour <= toHour && (
								<div className="week-grid-now" style={{ top: allDayRow + (nowHour - fromHour) * pxPerHour }} />
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
