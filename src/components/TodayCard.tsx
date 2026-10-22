import { useMemo } from "react";
import { useCalendarDays } from "../hooks/useCalendarEvents";
import type { CalendarEvent } from "../calendarIcs";

function clock(d: Date, use24h: boolean): string {
	const m = d.getMinutes().toString().padStart(2, "0");
	if (use24h) return `${d.getHours().toString().padStart(2, "0")}:${m}`;
	return `${d.getHours() % 12 || 12}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

/** The event to show for the rest of today: ongoing or next timed one first, then all-day. */
function pickToday(list: CalendarEvent[], now: Date): CalendarEvent | null {
	const timed = list.find((ev) => !ev.allDay && ev.end > now);
	if (timed) return timed;
	return list.find((ev) => ev.allDay && ev.end > now) ?? null;
}

/**
 * Today at a glance for the Command Center: a date tile plus the next thing
 * on today's calendar. Without a linked calendar the second line shows
 * `fallback` instead.
 */
export function TodayCard({
	use24h,
	fallback,
	onOpenCalendar
}: {
	use24h: boolean;
	fallback: string;
	onOpenCalendar?: () => void;
}) {
	const now = new Date();
	const { days, status } = useCalendarDays(now, 1);
	const today = days[0] ?? [];

	const next = useMemo(
		() => pickToday(today, new Date()),
		// Recomputed whenever the parent re-renders past an event's end.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[today, Math.floor(now.getTime() / 60000)]
	);

	const weekday = now.toLocaleDateString([], { weekday: "short" }).toUpperCase();
	const fullDate = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });

	let detail: string;
	let title: string | undefined;
	if (status === "off") {
		detail = fallback;
	} else if (status === "loading" && today.length === 0) {
		detail = "Checking your calendar…";
	} else if (status === "error" && today.length === 0) {
		detail = "Couldn't load your calendar";
	} else if (!next) {
		detail = "Nothing else today";
	} else {
		const remaining = today.filter((ev) => ev.end > now).length;
		const more = remaining > 1 ? ` (+${remaining - 1})` : "";
		detail = next.allDay
			? `All day · ${next.title}${more}`
			: next.start <= now
				? `${next.title} · until ${clock(next.end, use24h)}${more}`
				: `${clock(next.start, use24h)} · ${next.title}${more}`;
		title = today
			.filter((ev) => ev.end > now)
			.map((ev) => `${ev.allDay ? "All day" : clock(ev.start, use24h)}  ${ev.title}`)
			.join("\n");
	}

	return (
		<>
			<button
				className="cc-mini-date"
				onClick={(e) => {
					e.stopPropagation();
					onOpenCalendar?.();
				}}
				disabled={!onOpenCalendar}
				title={onOpenCalendar ? "Open calendar" : undefined}
			>
				<span className="cc-mini-date-day">{weekday}</span>
				<span className="cc-mini-date-num">{now.getDate()}</span>
			</button>
			<span className="cc-mini-today" title={title}>
				<span className="cc-mini-today-date">{fullDate}</span>
				<span className="cc-mini-today-detail">{detail}</span>
			</span>
		</>
	);
}
