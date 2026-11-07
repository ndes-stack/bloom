import { Target } from "lucide-react";
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
