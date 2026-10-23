import { emit } from "@tauri-apps/api/event";
import { Sparkles, Eye, Video, Timer } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";
import {
	ACTIVITY_STYLE_KEY,
	KEEP_TIMER_VISIBLE_KEY,
	PRIVACY_DOT_KEY,
	parseActivityStyle,
	type ActivityStyle
} from "../liveActivities";
import { parseBool, REMINDER_PREVIEW_EVENT } from "../reminders";

const STYLE_OPTIONS: { value: ActivityStyle; label: string; hint: string }[] = [
	{ value: "island", label: "Stretch", hint: "The notch itself grows to show it" },
	{ value: "glow", label: "Glow", hint: "Stays small, a coloured line glows underneath" },
	{ value: "tags", label: "Tags", hint: "Little labels hang under the notch" },
	{ value: "rail", label: "Rail", hint: "A thin readout strip out of both sides" },
	{ value: "cards", label: "Cards", hint: "A light card drops out below" }
];

/** Settings > Appearance > Live Activities. */
export function ActivityStyleSettings() {
	const [style, setStyle] = useStored(ACTIVITY_STYLE_KEY, parseActivityStyle);
	const [privacyDot, setPrivacyDot] = useStored(PRIVACY_DOT_KEY, (v) => parseBool(v, true));
	const [keepTimer, setKeepTimer] = useStored(KEEP_TIMER_VISIBLE_KEY, (v) => parseBool(v, true));
	return (
		<>
			<SettingRow
				icon={Sparkles}
				label="Style"
				desc="How the notch shows class reminders, timers, music and charging"
				divider={false}
			/>
			<div className="activity-styles" role="radiogroup" aria-label="Live activity style">
				{STYLE_OPTIONS.map((opt) => (
					<button
						key={opt.value}
						role="radio"
						aria-checked={style === opt.value}
						className={`activity-style ${style === opt.value ? "selected" : ""}`}
						onClick={() => setStyle(opt.value)}
						title={opt.hint}
					>
						<span className={`activity-preview ${opt.value}`} aria-hidden="true">
							<span className="ap-pill" />
							<span className="ap-a" />
							<span className="ap-b" />
						</span>
						<span className="activity-style-label">{opt.label}</span>
					</button>
				))}
			</div>
			<div className="setting-divider" />
			<SettingRow
				icon={Timer}
				label="Keep Timer On Screen"
				desc={
					keepTimer
						? "The notch stays out while a timer runs; Time's up stays until you click it"
						: "The timer hides with the notch in auto-hide and peek modes"
				}
			>
				<label className="toggle-switch">
					<input type="checkbox" checked={keepTimer} onChange={() => setKeepTimer(!keepTimer)} />
					<span className="slider"></span>
				</label>
			</SettingRow>
			<SettingRow
				icon={Video}
				label="Camera & Mic Dot"
				desc="A green (camera) or orange (mic) dot beside the notch while an app uses them"
			>
				<label className="toggle-switch">
					<input type="checkbox" checked={privacyDot} onChange={() => setPrivacyDot(!privacyDot)} />
					<span className="slider"></span>
				</label>
			</SettingRow>
			<SettingRow icon={Eye} label="Preview" desc="Shows a made-up class reminder in this style" divider={false}>
				<button className="reminder-preview-btn" onClick={() => emit(REMINDER_PREVIEW_EVENT).catch(() => {})}>
					Show preview
				</button>
			</SettingRow>
		</>
	);
}
