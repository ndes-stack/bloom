import type { ComponentType, ReactNode } from "react";
import { Music, Pause, Play, SkipBack, SkipForward, type LucideProps } from "lucide-react";
import { type StudyLog } from "../study";
import type { HomeSize, MusicSide } from "../homeLayout";
import { GoalRing } from "./GoalRing";
import { NextUp, TodayCard } from "./TodayCard";
import "./HomePage.css";

interface HomePageProps {
	size: HomeSize;
	musicSide: MusicSide;
	/** The lyric line for this moment of the song, when there is one. */
	lyric?: string | null;
	media: { title: string; artist: string; is_playing: boolean; has_media: boolean };
	art: string | null;
	onPlayPause: () => void;
	onNext: () => void;
	onPrevious: () => void;
	time: string;
	now: Date;
	weather: { temperature: number | null; condition: string; unit: string; Icon: ComponentType<LucideProps> | null };
	log: StudyLog;
	goal: number;
	use24h: boolean;
	onFocus?: () => void;
	onOpenCalendar?: () => void;
}

/**
 * Home, in one of four sizes (homeLayout.ts). Full: music, the time, today and
 * the focus goal. Compact, Strip and Glance keep music, the goal and what's
 * next, and leave music out while nothing is playing. The music side picks
 * which end music sits at (the bottom, for Glance).
 */
export function HomePage(props: HomePageProps) {
	const { size, musicSide, media, now } = props;
	const right = musicSide === "right";
	const hasMusic = media.has_media;
	const ordered = (parts: ReactNode[]) => (right ? [...parts].reverse() : parts);

	const art = (px: number) => (
		<span className="home-art" style={{ width: px, height: px, borderRadius: Math.round(px * 0.24) }}>
			{props.art ? <img src={props.art} alt="" draggable={false} /> : <Music size={Math.round(px * 0.36)} />}
			{props.art && size === "full" && (
				<img className="home-art-glow" src={props.art} alt="" aria-hidden="true" draggable={false} />
			)}
		</span>
	);
	const trackText = (
		<span className="home-track-text">
			<span className="home-title">{media.title || "Unknown title"}</span>
			<span className="home-artist">{media.artist}</span>
			{props.lyric && (size === "full" || size === "compact") && (
				<span key={props.lyric} className="home-lyric">
					{props.lyric}
				</span>
			)}
		</span>
	);
	const playButton = (px: number) => (
		<button
			className="home-play"
			style={{ width: px, height: px, borderRadius: px / 2 }}
			aria-label={media.is_playing ? "Pause" : "Play"}
			onClick={props.onPlayPause}
		>
			{media.is_playing ? (
				<Pause size={Math.round(px * 0.4)} fill="currentColor" />
			) : (
				<Play size={Math.round(px * 0.4)} fill="currentColor" />
			)}
		</button>
	);
	const controls = (play: number) => (
		<div className="home-controls">
			<button aria-label="Previous" onClick={props.onPrevious}>
				<SkipBack size={15} fill="currentColor" />
			</button>
			{playButton(play)}
			<button aria-label="Next" onClick={props.onNext}>
				<SkipForward size={15} fill="currentColor" />
			</button>
		</div>
	);
	const nextUp = (
		<NextUp use24h={props.use24h} fallback="Nothing else today" onOpenCalendar={props.onOpenCalendar} />
	);
	const focusButton = props.onFocus && (
		<button className="home-focus" onClick={props.onFocus}>
			Focus
		</button>
	);
	const divider = (key: string) => <span key={key} className="home-divider" aria-hidden="true" />;

	if (size === "compact") {
		const music = (
			<section key="music" className="home-music-compact" aria-label="Music">
				{art(54)}
				<span className="home-music-stack">
					{trackText}
					{controls(30)}
				</span>
			</section>
		);
		const side = (
			<section key="side" className="home-side" aria-label="Today and focus">
				<GoalRing log={props.log} now={now} goal={props.goal} size={34} />
				{nextUp}
			</section>
		);
		const columns = hasMusic ? (right ? "168px 1px minmax(0, 1fr)" : "minmax(0, 1fr) 1px 168px") : "minmax(0, 1fr)";
		return (
			<div className="home home-compact" style={{ gridTemplateColumns: columns }} onClick={(e) => e.stopPropagation()}>
				{hasMusic ? ordered([music, divider("d"), side]) : side}
			</div>
		);
	}

	if (size === "strip") {
		const music = (
			<section key="music" className="home-music-strip" aria-label="Music">
				{art(30)}
				<span className="home-title">{media.title || "Unknown title"}</span>
				{playButton(26)}
			</section>
		);
		const goal = (
			<span key="goal" className="home-strip-goal">
				<GoalRing log={props.log} now={now} goal={props.goal} size={22} text="short" />
			</span>
		);
		const next = (
			<span key="next" className="home-strip-next">
				{nextUp}
			</span>
		);
		const parts = hasMusic ? [music, divider("d1"), goal, divider("d2"), next] : [goal, divider("d2"), next];
		return (
			<div className="home home-strip" onClick={(e) => e.stopPropagation()}>
				{ordered(parts)}
			</div>
		);
	}

	if (size === "glance") {
		const music = (
			<section key="music" className="home-music-glance" aria-label="Music">
				{art(42)}
				{trackText}
				{playButton(30)}
			</section>
		);
		const focus = (
			<section key="focus" className="home-glance-focus" aria-label="Today and focus">
				<GoalRing log={props.log} now={now} goal={props.goal} size={38} text="inline" />
				{focusButton}
				<span className="home-glance-next">{nextUp}</span>
			</section>
		);
		return (
			<div className="home home-glance" onClick={(e) => e.stopPropagation()}>
				{hasMusic ? ordered([music, <span key="hr" className="home-rule" aria-hidden="true" />, focus]) : focus}
			</div>
		);
	}

	// Full
	const { weather } = props;
	const Icon = weather.Icon;
	const date = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
	const music = (
		<section key="music" className="home-music" aria-label="Music">
			{hasMusic ? (
				<>
					<div className="home-track">
						{art(58)}
						{trackText}
					</div>
					{controls(38)}
				</>
			) : (
				<div className="home-quiet">
					{art(58)}
					<span className="home-artist">Nothing playing</span>
				</div>
			)}
		</section>
	);
	const clock = (
		<section key="now" className="home-now" aria-label="Now">
			<span className="home-time">{props.time}</span>
			<span className="home-date">{date}</span>
			{weather.temperature !== null && (
				<span className="home-weather">
					{Icon && <Icon size={13} />}
					{Math.round(weather.temperature)}°{weather.unit} {weather.condition && `· ${weather.condition}`}
				</span>
			)}
		</section>
	);
	const today = (
		<section key="next" className="home-next" aria-label="Today and focus">
			<TodayCard use24h={props.use24h} fallback="Nothing else today" onOpenCalendar={props.onOpenCalendar} />
			<div className="home-goal">
				<GoalRing log={props.log} now={now} goal={props.goal} size={42} />
				{focusButton}
			</div>
		</section>
	);
	return (
		<div className="home" onClick={(e) => e.stopPropagation()}>
			{ordered([music, clock, today])}
		</div>
	);
}
