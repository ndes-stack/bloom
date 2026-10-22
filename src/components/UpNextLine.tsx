import { useMemo } from "react";
import { useCalendarDays } from "../hooks/useCalendarEvents";
import { isImportantEvent } from "../calendarIcs";

/** "in 25 min", "in 3 h", "in 2 days". */
function timeUntil(target: Date, now: Date): string {
	const mins = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
	if (mins < 60) return `in ${mins} min`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `in ${hours} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
	const days = Math.round(hours / 24);
	return `in ${days} day${days === 1 ? "" : "s"}`;
}

function clock(d: Date, use24h: boolean): string {
	const m = d.getMinutes().toString().padStart(2, "0");
	if (use24h) return `${d.getHours().toString().padStart(2, "0")}:${m}`;
	return `${d.getHours() % 12 || 12}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

/**
 * The next (or current) event from the linked calendar, for the Command
 * Center dashboard. Renders nothing when no calendar is linked.
 */
export function UpNextLine({ use24h }: { use24h: boolean }) {
	const today = new Date();
	const { days, status } = useCalendarDays(today, 14);
	const now = new Date();

	const next = useMemo(() => {
		for (const list of days) {
			const hit = list.find((ev) => (ev.allDay ? ev.end > now : ev.end > now));
			if (hit) return hit;
		}
		return null;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [days]);

	if (status === "off" || status === "loading") return null;

	let when = "";
	if (next) {
		const ongoing = next.start <= now;
		const sameDay = next.start.toDateString() === now.toDateString();
		const day = sameDay ? "Today" : next.start.toLocaleDateString([], { weekday: "short" });
		when = ongoing
			? `Now · until ${clock(next.end, use24h)}`
			: `${day} ${next.allDay ? "all day" : clock(next.start, use24h)} · ${timeUntil(next.start, now)}`;
	}

	return (
		<div className="cc-dash-upnext">
			<span className={`cc-dash-upnext-bar ${next && isImportantEvent(next) ? "important" : ""}`} />
			<span className="cc-dash-upnext-text">
				<span className="cc-dash-label">{next ? `Up next · ${when}` : "Up next"}</span>
				<span className="cc-dash-upnext-title">{next ? next.title : "Nothing in the next two weeks"}</span>
			</span>
		</div>
	);
}
