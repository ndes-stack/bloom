import { emit } from "@tauri-apps/api/event";
import { Sparkles, Eye } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";
import { ACTIVITY_STYLE_KEY, parseActivityStyle, type ActivityStyle } from "../liveActivities";
import { REMINDER_PREVIEW_EVENT } from "../reminders";

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
			<SettingRow icon={Eye} label="Preview" desc="Shows a made-up class reminder in this style" divider={false}>
				<button className="reminder-preview-btn" onClick={() => emit(REMINDER_PREVIEW_EVENT).catch(() => {})}>
					Show preview
				</button>
			</SettingRow>
		</>
	);
}
