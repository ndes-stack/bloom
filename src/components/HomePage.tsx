import type { ComponentType } from "react";
import { Music, Pause, Play, SkipBack, SkipForward, type LucideProps } from "lucide-react";
import { type StudyLog } from "../study";
import { GoalRing } from "./GoalRing";
import { TodayCard } from "./TodayCard";
import "./HomePage.css";

export const HOME_PAGE_WIDTH = 640;
export const HOME_PAGE_HEIGHT = 186;

interface HomePageProps {
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

/** Home: the song on the left, the time in the middle, today and the focus goal on the right. */
export function HomePage(props: HomePageProps) {
	const { media, art, weather, now } = props;
	const date = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
	const Icon = weather.Icon;
	return (
		<div className="home" onClick={(e) => e.stopPropagation()}>
			<section className="home-music" aria-label="Music">
				{media.has_media ? (
					<>
						<div className="home-track">
							<span className="home-art">
								{art ? <img src={art} alt="" draggable={false} /> : <Music size={20} />}
								{art && <img className="home-art-glow" src={art} alt="" aria-hidden="true" draggable={false} />}
							</span>
							<span className="home-track-text">
								<span className="home-title">{media.title || "Unknown title"}</span>
								<span className="home-artist">{media.artist}</span>
							</span>
						</div>
						<div className="home-controls">
							<button aria-label="Previous" onClick={props.onPrevious}>
								<SkipBack size={15} fill="currentColor" />
							</button>
							<button className="home-play" aria-label={media.is_playing ? "Pause" : "Play"} onClick={props.onPlayPause}>
								{media.is_playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
							</button>
							<button aria-label="Next" onClick={props.onNext}>
								<SkipForward size={15} fill="currentColor" />
							</button>
						</div>
					</>
				) : (
					<div className="home-quiet">
						<span className="home-art">
							<Music size={20} />
						</span>
						<span className="home-artist">Nothing playing</span>
					</div>
				)}
			</section>

			<section className="home-now" aria-label="Now">
				<span className="home-time">{props.time}</span>
				<span className="home-date">{date}</span>
				{weather.temperature !== null && (
					<span className="home-weather">
						{Icon && <Icon size={13} />}
						{Math.round(weather.temperature)}°{weather.unit} {weather.condition && `· ${weather.condition}`}
					</span>
				)}
			</section>

			<section className="home-next" aria-label="Today and focus">
				<TodayCard use24h={props.use24h} fallback="Nothing else today" onOpenCalendar={props.onOpenCalendar} />
				<div className="home-goal">
					<GoalRing log={props.log} now={now} goal={props.goal} size={42} />
					{props.onFocus && (
						<button className="home-focus" onClick={props.onFocus}>
							Focus
						</button>
					)}
				</div>
			</section>
		</div>
	);
}
