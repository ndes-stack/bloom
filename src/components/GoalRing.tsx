import { Flame } from "lucide-react";
import { goalProgress, goalStreak, studyDuration, type StudyLog } from "../study";
import "./GoalRing.css";

/** Today's focus as a ring, filling towards the daily goal; green once it's met. */
export function GoalRing({
	log,
	now,
	goal,
	size = 48,
	text = "full"
}: {
	log: StudyLog;
	now: Date;
	goal: number;
	size?: number;
	/** full: time and "of 4h today" on two lines; inline: "1h 20m of 4h"; short: just the time. */
	text?: "full" | "inline" | "short";
}) {
	const { done, target, progress, met } = goalProgress(log, now, goal);
	const streak = goalStreak(log, now, goal);
	const streakChip = streak > 0 && text !== "short" && (
		<span className={`goal-streak${met ? " lit" : ""}`} title={`Goal met ${streak} day${streak === 1 ? "" : "s"} in a row`}>
			<Flame size={10} aria-hidden="true" />
			{streak}
		</span>
	);
	const stroke = Math.max(3, Math.round(size / 10));
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	return (
		<div className="goal">
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				role="img"
				aria-label={`${studyDuration(done)} of a ${studyDuration(target)} goal today`}
				className={`goal-ring ${met ? "met" : ""}`}
			>
				<circle className="goal-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
				<circle
					className="goal-fill"
					cx={size / 2}
					cy={size / 2}
					r={r}
					strokeWidth={stroke}
					strokeDasharray={c}
					strokeDashoffset={c * (1 - progress)}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</svg>
			{text === "full" ? (
				<span className="goal-text">
					<span className="goal-done">
						{studyDuration(done)}
						{streakChip}
					</span>
					<span className="goal-of">of {studyDuration(target)} today</span>
				</span>
			) : (
				<span className="goal-done">
					{studyDuration(done)}
					{text === "inline" && ` of ${studyDuration(target)}`}
					{streakChip}
				</span>
			)}
		</div>
	);
}
