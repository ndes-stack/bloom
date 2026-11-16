import { useEffect, useState } from "react";
import { BatteryLow, CloudRain, Flame, Focus, MicVocal, MousePointerClick, Timer } from "lucide-react";
import {
	DEFAULT_NUDGE_APPS,
	DEVICE_BATTERY_NOTICE_KEY,
	GOAL_NOTICE_KEY,
	LYRICS_KEY,
	NUDGE_APPS_KEY,
	NUDGE_KEY,
	RAIN_NOTICE_KEY,
	SHELF_EXPIRY_CHOICES,
	SHELF_EXPIRY_KEY,
	SHELF_REMOVE_ON_DROP_KEY,
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

/** Settings > Notch > Shelf: how items leave the shelf on their own. */
export function ShelfTidySettings() {
	const [removeOnDrop, setRemoveOnDrop] = useStored(SHELF_REMOVE_ON_DROP_KEY, parseOn);
	const [expiry, setExpiry] = useStored(SHELF_EXPIRY_KEY, (v) =>
		SHELF_EXPIRY_CHOICES.some((c) => c.value === v) ? (v as string) : "never"
	);
	return (
		<>
			<SettingRow icon={MousePointerClick} label="Remove After Dragging Out" desc="Items leave the shelf once you drop them somewhere">
				<Toggle on={removeOnDrop} set={setRemoveOnDrop} />
			</SettingRow>
			<SettingRow icon={Timer} label="Clear Old Items" desc="Take items off the shelf after a while">
				<select className="settings-select" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
					{SHELF_EXPIRY_CHOICES.map((c) => (
						<option key={c.value} value={c.value}>
							{c.label}
						</option>
					))}
				</select>
			</SettingRow>
		</>
	);
}
