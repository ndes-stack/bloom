import { useMemo, useState } from "react";
import { Flame, Play } from "lucide-react";
import { moduleColor, studyDuration, summarize, type ModuleColors, type StudyLog, type StudyRange } from "../study";
import "./StudyStats.css";

export const STUDY_PAGE_WIDTH = 460;
export const STUDY_PAGE_HEIGHT = 196;

const RANGE_KEY = "bloom-study-range";
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MAX_ROWS = 4;

interface StudyStatsProps {
	log: StudyLog;
	colors: ModuleColors;
	/** Re-rendered by the notch's clock, so "today" rolls over at midnight. */
	now: Date;
	/** Opens the timer page; omitted when it's turned off. */
	onStartFocus?: () => void;
}

/** The notch's Study stats page: focus time per module, today or this week. */
export function StudyStats({ log, colors, now, onStartFocus }: StudyStatsProps) {
	const [range, setRange] = useState<StudyRange>(() => {
		try {
			return localStorage.getItem(RANGE_KEY) === "week" ? "week" : "today";
		} catch {
			return "today";
		}
	});
	const pick = (r: StudyRange) => {
		setRange(r);
		try {
			localStorage.setItem(RANGE_KEY, r);
		} catch {
			// Only a convenience.
		}
	};
	const dayStamp = now.toDateString();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const summary = useMemo(() => summarize(log, now, range), [log, range, dayStamp]);
	const rows = summary.byModule.slice(0, MAX_ROWS);
	const rest = summary.byModule.slice(MAX_ROWS).reduce((a, [, s]) => a + s, 0);
	if (rest > 0) rows.push(["…", rest]);
	const top = rows.reduce((a, [, s]) => Math.max(a, s), 0) || 1;
	const peakDay = Math.max(1, ...summary.perDay);
	const todayIndex = (now.getDay() + 6) % 7;

	return (
		<div className="study" onClick={(e) => e.stopPropagation()}>
			<div className="study-head">
				<div className="study-range" role="tablist" aria-label="Range">
					{(["today", "week"] as const).map((r) => (
						<button
							key={r}
							role="tab"
							aria-selected={range === r}
							className={range === r ? "on" : ""}
							onClick={() => pick(r)}
						>
							{r === "today" ? "Today" : "This week"}
						</button>
					))}
				</div>
				<div className="study-badges">
					<span className={`study-streak ${summary.streak > 0 ? "lit" : ""}`} title="Days in a row with 5+ minutes of focus">
						<Flame size={12} strokeWidth={2.4} />
						{summary.streak} day{summary.streak === 1 ? "" : "s"}
					</span>
					<span className="study-sessions" title="Timers that ran to the end">
						{summary.sessions} session{summary.sessions === 1 ? "" : "s"}
					</span>
				</div>
			</div>

			{summary.total === 0 ? (
				<div className="study-empty">
					<span>{range === "today" ? "No focus time yet today." : "No focus time yet this week."}</span>
					<span className="study-empty-hint">Start the timer and pick a module; it counts here.</span>
					{onStartFocus && (
						<button className="study-start" onClick={onStartFocus}>
							<Play size={11} strokeWidth={2} fill="currentColor" />
							Open timer
						</button>
					)}
				</div>
			) : (
				<div className="study-body">
					<div className="study-total">
						<span className="study-total-value">{studyDuration(summary.total)}</span>
						<span className="study-total-label">{range === "today" ? "focused today" : "focused this week"}</span>
						{range === "week" && (
							<div className="study-week" aria-label="Focus time per day">
								{summary.perDay.map((secs, i) => (
									<div
										key={i}
										className={`study-day ${i === todayIndex ? "today" : ""}`}
										title={`${studyDuration(secs)}`}
									>
										<div className="study-day-bar">
											<div style={{ height: `${Math.round((secs / peakDay) * 100)}%` }} />
										</div>
										<span>{DAY_LETTERS[i]}</span>
									</div>
								))}
							</div>
						)}
					</div>
					<div className="study-modules">
						{rows.map(([mod, secs]) => (
							<div className="study-row" key={mod || "none"}>
								<span className="study-row-name" title={mod || "No module"}>
									<i style={{ background: mod === "…" ? "#636366" : moduleColor(mod, colors) }} />
									{mod === "…" ? "Others" : mod || "No module"}
								</span>
								<span className="study-row-bar">
									<span
										style={{
											width: `${Math.max(4, Math.round((secs / top) * 100))}%`,
											background: mod === "…" ? "#636366" : moduleColor(mod, colors)
										}}
									/>
								</span>
								<span className="study-row-time">{studyDuration(secs)}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
