import { useEffect, useState } from "react";
import { BatteryLow, CloudRain, Flame, Focus, MicVocal } from "lucide-react";
import {
	DEFAULT_NUDGE_APPS,
	DEVICE_BATTERY_NOTICE_KEY,
	GOAL_NOTICE_KEY,
	LYRICS_KEY,
	NUDGE_APPS_KEY,
	NUDGE_KEY,
	RAIN_NOTICE_KEY,
	parseOn
} from "../notices";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";

function Toggle({ on, set }: { on: boolean; set: (v: boolean) => void }) {
	return (
		<label className="toggle-switch">
			<input type="checkbox" checked={on} onChange={() => set(!on)} />
			<span className="slider"></span>
		</label>
	);
}

/** Settings > Notch > Notices: the short one-line pops in the pill. */
export function NoticeSettings() {
	const [deviceBattery, setDeviceBattery] = useStored(DEVICE_BATTERY_NOTICE_KEY, parseOn);
	const [rain, setRain] = useStored(RAIN_NOTICE_KEY, parseOn);
	const [goal, setGoal] = useStored(GOAL_NOTICE_KEY, parseOn);
	const [nudge, setNudge] = useStored(NUDGE_KEY, parseOn);
	const [apps, setApps] = useStored(NUDGE_APPS_KEY, (v) => (typeof v === "string" ? v : DEFAULT_NUDGE_APPS));
	const [draft, setDraft] = useState(apps);
	useEffect(() => setDraft(apps), [apps]);
	return (
		<>
			<SettingRow icon={BatteryLow} label="Device Battery" desc="When earbuds or another device run low">
				<Toggle on={deviceBattery} set={setDeviceBattery} />
			</SettingRow>
			<SettingRow icon={CloudRain} label="Rain Heads-Up" desc="When rain is due within the next hour or so">
				<Toggle on={rain} set={setRain} />
			</SettingRow>
			<SettingRow icon={Flame} label="Goal Reached" desc="When you hit your daily focus goal, with your streak">
				<Toggle on={goal} set={setGoal} />
			</SettingRow>
			<SettingRow
				icon={Focus}
				label="Focus Nudge"
				desc="While a timer runs, a gentle note if one of these comes to the front"
			>
				<Toggle on={nudge} set={setNudge} />
			</SettingRow>
			{nudge && (
				<div className="notice-apps">
					<input
						type="text"
						className="notice-apps-input"
						value={draft}
						spellCheck={false}
						placeholder={DEFAULT_NUDGE_APPS}
						aria-label="Apps and sites to nudge about, separated by commas"
						onChange={(e) => setDraft(e.target.value)}
						onBlur={() => draft !== apps && setApps(draft)}
						onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
					/>
				</div>
			)}
		</>
	);
}

/** Settings > Notch > Music: the lyric line on Home. */
export function LyricsSetting() {
	const [lyrics, setLyrics] = useStored(LYRICS_KEY, parseOn);
	return (
		<SettingRow icon={MicVocal} label="Lyrics On Home" desc="Shows the line being sung. Looks the song up on lrclib.net">
			<Toggle on={lyrics} set={setLyrics} />
		</SettingRow>
	);
}
