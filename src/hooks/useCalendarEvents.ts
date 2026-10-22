import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { eventsByDay, parseIcs, type CalendarEvent, type ParsedCalendar } from "../calendarIcs";

export const CALENDAR_URL_KEY = "bloom-calendar-ics-url";

/** How often a visible calendar re-downloads the feed. */
const REFRESH_MS = 10 * 60 * 1000;

export type CalendarFeedStatus = "off" | "loading" | "ready" | "error";

interface FeedState {
	status: CalendarFeedStatus;
	calendar: ParsedCalendar | null;
	error: string | null;
	fetchedAt: number;
}

// The Calendar component unmounts whenever the notch leaves calendar mode, so
// the downloaded feed lives at module level and survives remounts instead of
// being re-fetched every time the island opens.
let feed: FeedState = { status: "off", calendar: null, error: null, fetchedAt: 0 };
let inflight: Promise<void> | null = null;
let generation = 0;
const subscribers = new Set<(s: FeedState) => void>();

function publish(next: FeedState) {
	feed = next;
	subscribers.forEach((fn) => fn(feed));
}

/** Downloads and parses the feed. Concurrent calls share one request. */
export function refreshCalendarFeed(): Promise<void> {
	if (inflight) return inflight;
	const gen = generation;
	if (!feed.calendar) publish({ ...feed, status: "loading", error: null });
	const request: Promise<void> = invoke<string | null>("fetch_calendar_ics")
		.then((text) => {
			if (gen !== generation) return; // Link changed mid-download.
			if (text === null) {
				publish({ status: "off", calendar: null, error: null, fetchedAt: Date.now() });
			} else {
				publish({ status: "ready", calendar: parseIcs(text), error: null, fetchedAt: Date.now() });
			}
		})
		.catch((err) => {
			if (gen !== generation) return;
			// Keep showing the last good events if a refresh fails (e.g. offline).
			publish({
				status: feed.calendar ? "ready" : "error",
				calendar: feed.calendar,
				error: String(err),
				fetchedAt: Date.now()
			});
		})
		.finally(() => {
			// A reset may already have started a newer request; leave that one alone.
			if (inflight === request) inflight = null;
		});
	inflight = request;
	return request;
}

/** Drops the cached feed (used when the link is changed or removed). */
function resetFeed() {
	generation++;
	inflight = null;
	publish({ status: "off", calendar: null, error: null, fetchedAt: 0 });
}

let settingsListenersStarted = false;

// One app-wide listener: when the link changes in Settings, start over.
function watchCalendarSetting() {
	if (settingsListenersStarted) return;
	settingsListenersStarted = true;
	const onChange = (event: { payload: { key: string } }) => {
		if (event.payload?.key !== CALENDAR_URL_KEY) return;
		resetFeed();
		if (subscribers.size > 0) refreshCalendarFeed();
	};
	listen<{ key: string }>("settings-changed", onChange);
	listen<{ key: string }>("settings-external-changed", onChange);
}

/**
 * Events from the user's linked calendar, grouped by day of the given month.
 * Returns an empty map when no calendar is linked.
 */
export function useCalendarEvents(year: number, month: number) {
	const [state, setState] = useState<FeedState>(feed);

	useEffect(() => {
		watchCalendarSetting();
		subscribers.add(setState);
		setState(feed);
		if (Date.now() - feed.fetchedAt > REFRESH_MS) refreshCalendarFeed();
		const timer = window.setInterval(() => refreshCalendarFeed(), REFRESH_MS);
		return () => {
			subscribers.delete(setState);
			window.clearInterval(timer);
		};
	}, []);

	const byDay = useMemo<Map<number, CalendarEvent[]>>(
		() => (state.calendar ? eventsByDay(state.calendar, year, month) : new Map()),
		[state.calendar, year, month]
	);

	return { status: state.status, error: state.error, byDay };
}
