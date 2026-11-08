import { House, Music, Target, Timer } from "lucide-react";
import { HOME_MUSIC_SIDE_KEY, HOME_SIZE_KEY, HOME_SIZES, parseHomeSize, parseMusicSide } from "../homeLayout";
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

/** Settings > Notch > Pages: how big Home is, and which side its music sits on. */
export function HomeLayoutSetting() {
	const [size, setSize] = useStored(HOME_SIZE_KEY, parseHomeSize);
	const [side, setSide] = useStored(HOME_MUSIC_SIDE_KEY, parseMusicSide);
	return (
		<>
			<SettingRow icon={House} label="Home Size" desc="Full, or smaller pages that cover less of the screen">
				<select className="settings-select" value={size} onChange={(e) => setSize(parseHomeSize(e.target.value))}>
					{HOME_SIZES.map((s) => (
						<option key={s.value} value={s.value}>
							{s.label}
						</option>
					))}
				</select>
			</SettingRow>
			<SettingRow
				icon={Music}
				label="Home Music Side"
				desc={size === "glance" ? "Glance stacks it: right puts music at the bottom" : "Which end of Home the music sits at"}
			>
				<select className="settings-select" value={side} onChange={(e) => setSide(parseMusicSide(e.target.value))}>
					<option value="right">Right</option>
					<option value="left">Left</option>
				</select>
			</SettingRow>
		</>
	);
}
