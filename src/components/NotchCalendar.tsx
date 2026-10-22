import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { describeEventTime } from "../calendarIcs";

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

const POPUP_WIDTH = 196;
const POPUP_MAX_EVENTS = 4;

export function NotchCalendar() {
	const [date] = useState(new Date());
	const [popup, setPopup] = useState<DayPopup | null>(null);

	const currentMonth = date.getMonth();
	const currentYear = date.getFullYear();
	const monthName = date.toLocaleString("default", { month: "long" });
	const { byDay, status, error } = useCalendarEvents(currentYear, currentMonth);

	const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
	const startDay = new Date(currentYear, currentMonth, 1).getDay();
	const today = new Date().getDate();
	const isCurrentMonth =
		new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;

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

	const days = [];
	for (let i = 0; i < startDay; i++) {
		days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
	}
	for (let i = 1; i <= totalDays; i++) {
		const events = byDay.get(i);
		const classes = ["calendar-day"];
		if (isCurrentMonth && i === today) classes.push("today");
		if (events) classes.push("has-events");
		days.push(
			<div
				key={i}
				className={classes.join(" ")}
				onMouseEnter={(e) => (events ? showPopup(i, e.currentTarget) : setPopup(null))}
				onMouseLeave={() => setPopup((cur) => (cur?.day === i ? null : cur))}
			>
				{i}
				{events && (
					<span className="calendar-day-dots" aria-hidden="true">
						{events.slice(0, 3).map((ev) => (
							<span key={ev.id} className="calendar-day-dot" />
						))}
					</span>
				)}
			</div>
		);
	}

	const popupEvents = popup ? (byDay.get(popup.day) ?? []) : [];
	const popupDate = popup ? new Date(currentYear, currentMonth, popup.day) : null;

	return (
		<div className="calendar-container">
			<div className="calendar-header">
				<span className="month-year">
					{monthName} {currentYear}
				</span>
				{status === "error" && error && (
					<span className="calendar-sync-error" title={error}>
						Calendar not synced
					</span>
				)}
			</div>
			<div className="calendar-grid">
				{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
					<div key={`${d}-${i}`} className="day-name">
						{d}
					</div>
				))}
				{days}
			</div>

			<AnimatePresence>
				{popup && popupDate && popupEvents.length > 0 && (
					<motion.div
						key={popup.day}
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
