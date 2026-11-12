import { useEffect, useRef, useState } from "react";

// Time-synced lyrics from lrclib.net (free, no key), for the line under the
// song on Home. Only the track's title and artist are sent. Off in
// Settings > Notch > Music & Media stops the lookups.
interface Line {
	at: number;
	text: string;
}

interface Media {
	title: string;
	artist: string;
	is_playing: boolean;
	has_media: boolean;
	position_ms?: number;
	duration_ms?: number;
	position_updated_at?: number;
}

/** "[01:23.45] words" lines to times in ms; lines without words are dropped. */
export function parseLrc(lrc: string): Line[] {
	const lines: Line[] = [];
	for (const raw of lrc.split("\n")) {
		const m = /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/.exec(raw.trim());
		if (!m) continue;
		const text = m[3].trim();
		if (text) lines.push({ at: (parseInt(m[1], 10) * 60 + parseFloat(m[2])) * 1000, text });
	}
	return lines.sort((a, b) => a.at - b.at);
}

/** The line being sung at `position`, or null before the first one. */
export function lineAt(lines: Line[], position: number): string | null {
	let current: string | null = null;
	for (const line of lines) {
		if (line.at > position) break;
		current = line.text;
	}
	return current;
}

const cache = new Map<string, Line[] | null>();

async function fetchLyrics(title: string, artist: string, durationMs: number): Promise<Line[] | null> {
	const params = new URLSearchParams({ track_name: title, artist_name: artist });
	if (durationMs > 0) params.set("duration", String(Math.round(durationMs / 1000)));
	const response = await fetch(`https://lrclib.net/api/get?${params}`);
	if (!response.ok) return null;
	const data = await response.json();
	const synced = typeof data?.syncedLyrics === "string" ? parseLrc(data.syncedLyrics) : [];
	return synced.length > 0 ? synced : null;
}

/**
 * The lyric line for the current moment of the playing song, or null when
 * off, paused long enough to be unsure, or the song has no synced lyrics.
 * `active` keeps the clock (twice a second) running only while it is shown.
 */
export function useLyrics(media: Media, enabled: boolean, active: boolean): string | null {
	const [lines, setLines] = useState<Line[] | null>(null);
	const [line, setLine] = useState<string | null>(null);
	const mediaRef = useRef(media);
	mediaRef.current = media;
	const wanted = enabled && media.has_media && !!media.title && !!media.artist;
	const key = `${media.title}\n${media.artist}`;

	useEffect(() => {
		setLines(null);
		if (!wanted) return;
		if (cache.has(key)) {
			setLines(cache.get(key) ?? null);
			return;
		}
		let stale = false;
		// Players often report the title a moment before the duration.
		const timer = setTimeout(() => {
			const m = mediaRef.current;
			fetchLyrics(m.title, m.artist, m.duration_ms ?? 0)
				.then((found) => {
					cache.set(key, found);
					if (cache.size > 40) cache.delete(cache.keys().next().value as string);
					if (!stale) setLines(found);
				})
				.catch(() => {});
		}, 800);
		return () => {
			stale = true;
			clearTimeout(timer);
		};
	}, [key, wanted]);

	useEffect(() => {
		if (!lines || !active) {
			setLine(null);
			return;
		}
		const tick = () => {
			const m = mediaRef.current;
			const base = m.position_ms ?? 0;
			const since = m.is_playing && m.position_updated_at ? Date.now() - m.position_updated_at : 0;
			// A player that never reports its position can't be followed.
			if (!m.position_updated_at) return setLine(null);
			setLine(lineAt(lines, base + Math.max(0, since)));
		};
		tick();
		const interval = setInterval(tick, 500);
		return () => clearInterval(interval);
	}, [lines, active]);

	return line;
}
