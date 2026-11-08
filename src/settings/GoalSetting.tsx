import { Target, Timer } from "lucide-react";
import { KEEP_TIMER_VISIBLE_KEY } from "../liveActivities";
import { parseBool } from "../reminders";
import { GOAL_CHOICES, parseGoal, STUDY_GOAL_KEY } from "../study";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";

/** Settings > Notch > Calendar & Timer: today's focus goal, for the ring on Home and Focus stats. */
export function GoalSetting() {
	const [goal, setGoal] = useStored(STUDY_GOAL_KEY, parseGoal);
	return (
		<SettingRow icon={Target} label="Daily Focus Goal" desc="The ring on Home and Focus stats fills towards it">
			<select className="settings-select" value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
				{GOAL_CHOICES.map((m) => (
					<option key={m} value={m}>
						{m / 60} hour{m === 60 ? "" : "s"}
					</option>
				))}
			</select>
		</SettingRow>
	);
}

/**
 * Settings > Notch > Calendar & Timer: the same Keep Timer On Screen switch as
 * Appearance > Live Activities, kept here too so it sits with the timer.
 */
export function KeepTimerSetting() {
	const [keepTimer, setKeepTimer] = useStored(KEEP_TIMER_VISIBLE_KEY, (v) => parseBool(v, true));
	return (
		<SettingRow
			icon={Timer}
			label="Keep Timer On Screen"
			desc={
				keepTimer
					? "Stays out while a timer runs, even in auto-hide and peek"
					: "Hides with the notch in auto-hide and peek"
			}
		>
			<label className="toggle-switch">
				<input type="checkbox" checked={keepTimer} onChange={() => setKeepTimer(!keepTimer)} />
				<span className="slider"></span>
			</label>
		</SettingRow>
	);
}
