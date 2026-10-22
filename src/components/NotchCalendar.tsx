import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { describeEventTime, type CalendarEvent } from "../calendarIcs";

/** Week rows a month occupies (4 to 6). The notch sizes itself from this. */
export function monthRowCount(year: number, month: number): number {
	const firstWeekday = new Date(year, month, 1).getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	return Math.ceil((firstWeekday + daysInMonth) / 7);
}

// Hover popup for a calendar day. Positioned inside the calendar panel (the
// notch clips anything outside it), below the day, or above it when the day
// sits in the lower half of the panel.
interface DayPopup {
	day: number;
	left: number;
	top?: number;
	bottom?: number;
	maxHeight: number;
}

const POPUP_WIDTH = 220;
const POPUP_MAX_EVENTS = 5;
/** Event names shown inside a day box before switching to "+N more". */
const MAX_CHIPS = 2;

interface NotchCalendarProps {
	year: number;
	month: number;
	onChangeMonth: (delta: number) => void;
	onToday: () => void;
	use24h: boolean;
	/** Rendered at the right end of the header (the Calendar/Timer switch). */
	headerExtra?: ReactNode;
}

/** "14:30" or "2:30p": short enough to sit in front of a title in a day box. */
function shortTime(d: Date, use24h: boolean): string {
	const m = d.getMinutes().toString().padStart(2, "0");
	if (use24h) return `${d.getHours()}:${m}`;
	const h = d.getHours() % 12 || 12;
	return `${h}:${m}${d.getHours() < 12 ? "a" : "p"}`;
}

export function NotchCalendar({
	year,
	month,
	onChangeMonth,
	onToday,
	use24h,
	headerExtra
}: NotchCalendarProps) {
	const [popup, setPopup] = useState<DayPopup | null>(null);
	const { byDay, status, error } = useCalendarEvents(year, month);

	const now = new Date();
	const isCurrentMonth = now.getMonth() === month && now.getFullYear() === year;
	const today = now.getDate();
	const monthName = new Date(year, month, 1).toLocaleString("default", { month: "long" });
	const totalDays = new Date(year, month + 1, 0).getDate();
	const startDay = new Date(year, month, 1).getDay();

	const showPopup = (day: number, cell: HTMLElement) => {
		const panel = cell.closest(".calendar-timer-content") as HTMLElement | null;
		if (!panel) return;
		const p = panel.getBoundingClientRect();
		const c = cell.getBoundingClientRect();
		const margin = 6;
		const centered = c.left - p.left + c.width / 2 - POPUP_WIDTH / 2;
		const left = Math.max(margin, Math.min(centered, p.width - POPUP_WIDTH - margin));
		const cellTop = c.top - p.top;
		const cellBottom = c.bottom - p.top;
		if (cellTop + c.height / 2 > p.height / 2) {
			setPopup({ day, left, bottom: p.height - cellTop + 4, maxHeight: cellTop - 4 - margin });
		} else {
			setPopup({ day, left, top: cellBottom + 4, maxHeight: p.height - cellBottom - 4 - margin });
		}
	};

	const changeMonth = (delta: number) => {
		setPopup(null);
		onChangeMonth(delta);
	};

	const renderChip = (ev: CalendarEvent, day: Date) => {
		const startsToday =
			ev.start.getFullYear() === day.getFullYear() &&
			ev.start.getMonth() === day.getMonth() &&
			ev.start.getDate() === day.getDate();
		const showTime = !ev.allDay && startsToday;
		return (
			<span key={ev.id} className={`calendar-chip ${ev.allDay ? "all-day" : "timed"}`}>
				{showTime && <span className="calendar-chip-time">{shortTime(ev.start, use24h)}</span>}
				<span className="calendar-chip-title">{ev.title}</span>
			</span>
		);
	};

	const days = [];
	for (let i = 0; i < startDay; i++) {
		days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
	}
	for (let i = 1; i <= totalDays; i++) {
		const events = byDay.get(i) ?? [];
		const dayDate = new Date(year, month, i);
		const classes = ["calendar-day"];
		if (isCurrentMonth && i === today) classes.push("today");
		if (events.length > 0) classes.push("has-events");
		if (isCurrentMonth && i < today) classes.push("past");
		// Leave room for the "+N more" line when the chips can't fit them all.
		const chipCount = events.length > MAX_CHIPS ? MAX_CHIPS - 1 : events.length;
		days.push(
			<div
				key={i}
				className={classes.join(" ")}
				onMouseEnter={(e) => (events.length > 0 ? showPopup(i, e.currentTarget) : setPopup(null))}
				onMouseLeave={() => setPopup((cur) => (cur?.day === i ? null : cur))}
			>
				<span className="calendar-day-number">{i}</span>
				{events.length > 0 && (
					<span className="calendar-day-chips">
						{events.slice(0, chipCount).map((ev) => renderChip(ev, dayDate))}
						{events.length > chipCount && (
							<span className="calendar-chip-more">+{events.length - chipCount} more</span>
						)}
					</span>
				)}
			</div>
		);
	}

	const popupEvents = popup ? (byDay.get(popup.day) ?? []) : [];
	const popupDate = popup ? new Date(year, month, popup.day) : null;

	return (
		<div className="calendar-container wide">
			<div className="calendar-header">
				<div className="calendar-month-nav">
					<button
						className="calendar-nav-btn"
						onClick={() => changeMonth(-1)}
						title="Previous month"
						aria-label="Previous month"
					>
						<ChevronLeft size={14} strokeWidth={2.5} />
					</button>
					<span className="month-year">
						{monthName} {year}
					</span>
					<button
						className="calendar-nav-btn"
						onClick={() => changeMonth(1)}
						title="Next month"
						aria-label="Next month"
					>
						<ChevronRight size={14} strokeWidth={2.5} />
					</button>
					{!isCurrentMonth && (
						<button className="calendar-today-btn" onClick={() => (setPopup(null), onToday())}>
							Today
						</button>
					)}
				</div>
				<div className="calendar-header-right">
					{status === "error" && error && (
						<span className="calendar-sync-error" title={error}>
							Calendar not synced
						</span>
					)}
					{headerExtra}
				</div>
			</div>
			<div className="calendar-grid">
				{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
					<div key={d} className="day-name">
						{d}
					</div>
				))}
				{days}
			</div>

			<AnimatePresence>
				{popup && popupDate && popupEvents.length > 0 && (
					<motion.div
						key={`${year}-${month}-${popup.day}`}
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
							{popupDate.toLocaleDateString([], {
								weekday: "short",
								day: "numeric",
								month: "short"
							})}
						</div>
						{popupEvents.slice(0, POPUP_MAX_EVENTS).map((ev) => (
							<div key={ev.id} className="calendar-event-row">
								<span className="calendar-event-bar" />
								<div className="calendar-event-text">
									<div className="calendar-event-title">{ev.title}</div>
									<div className="calendar-event-meta">
										{describeEventTime(ev, popupDate)}
										{ev.location ? ` · ${ev.location}` : ""}
									</div>
								</div>
							</div>
						))}
						{popupEvents.length > POPUP_MAX_EVENTS && (
							<div className="calendar-event-more">
								+{popupEvents.length - POPUP_MAX_EVENTS} more
							</div>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
