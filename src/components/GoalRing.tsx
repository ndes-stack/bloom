import { goalProgress, studyDuration, type StudyLog } from "../study";
import "./GoalRing.css";

/** Today's focus as a ring, filling towards the daily goal; green once it's met. */
export function GoalRing({ log, now, goal, size = 48 }: { log: StudyLog; now: Date; goal: number; size?: number }) {
	const { done, target, progress, met } = goalProgress(log, now, goal);
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
			<span className="goal-text">
				<span className="goal-done">{studyDuration(done)}</span>
				<span className="goal-of">of {studyDuration(target)} today</span>
			</span>
		</div>
	);
}
