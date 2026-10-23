import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { BellRing, Clock, Timer, MoveHorizontal, CalendarOff, Volume2, Eye } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";
import {
	REMINDERS_ENABLED_KEY,
	REMINDER_DURATION_KEY,
	REMINDER_DURATION_OPTIONS,
	REMINDER_LEAD_KEY,
	REMINDER_LEAD_OPTIONS,
	REMINDER_PREVIEW_EVENT,
	REMINDER_SKIP_ALLDAY_KEY,
	REMINDER_SOUND_KEY,
	REMINDER_WIDTH_KEY,
	parseBool,
	parseReminderDuration,
	parseReminderLead,
	parseReminderWidth,
	type ReminderWidth
} from "../reminders";

/** Settings > Notch > Class Reminders. */
export function ReminderSettings({ hasCalendar }: { hasCalendar: boolean }) {
	const [enabled, setEnabled] = useStored(REMINDERS_ENABLED_KEY, (v) => parseBool(v, true));
	const [lead, setLead] = useStored(REMINDER_LEAD_KEY, parseReminderLead);
	const [duration, setDuration] = useStored(REMINDER_DURATION_KEY, parseReminderDuration);
	const [width, setWidth] = useStored<ReminderWidth>(REMINDER_WIDTH_KEY, parseReminderWidth);
	const [skipAllDay, setSkipAllDay] = useStored(REMINDER_SKIP_ALLDAY_KEY, (v) => parseBool(v, true));
	const [sound, setSound] = useStored(REMINDER_SOUND_KEY, (v) => parseBool(v, false));
	const [previewSent, setPreviewSent] = useState(false);

	useEffect(() => {
		if (!previewSent) return;
		const t = window.setTimeout(() => setPreviewSent(false), 2500);
		return () => window.clearTimeout(t);
	}, [previewSent]);

	return (
		<>
			<SettingRow
				icon={BellRing}
				label="Class Reminders"
				desc={
					hasCalendar
						? "A bar at the top of the screen before events start"
						: "Needs a Google Calendar link (Calendar & Timer above)"
				}
			>
				<label className="toggle-switch">
					<input type="checkbox" checked={enabled} onChange={() => setEnabled(!enabled)} />
					<span className="slider"></span>
				</label>
			</SettingRow>

			{enabled && (
				<>
					<SettingRow icon={Clock} label="Remind Me" desc="How long before the start">
						<select
							className="settings-select"
							value={lead}
							onChange={(e) => setLead(parseReminderLead(e.target.value))}
						>
							{REMINDER_LEAD_OPTIONS.map((m) => (
								<option key={m} value={m}>
									{m} min before
								</option>
							))}
						</select>
					</SettingRow>
					<SettingRow icon={Timer} label="Stay On Screen" desc="Hovering the bar keeps it up">
						<select
							className="settings-select"
							value={duration}
							onChange={(e) => setDuration(parseReminderDuration(e.target.value))}
						>
							{REMINDER_DURATION_OPTIONS.map((s) => (
								<option key={s} value={s}>
									{s === 0 ? "Until dismissed" : `${s} seconds`}
								</option>
							))}
						</select>
					</SettingRow>
					<SettingRow icon={MoveHorizontal} label="Bar Width" desc="Wide also shows the room">
						<select
							className="settings-select"
							value={width}
							onChange={(e) => setWidth(parseReminderWidth(e.target.value))}
						>
							<option value="compact">Compact</option>
							<option value="wide">Wide</option>
						</select>
					</SettingRow>
					<SettingRow icon={CalendarOff} label="Skip All-Day Events" desc="Only events with a start time">
						<label className="toggle-switch">
							<input type="checkbox" checked={skipAllDay} onChange={() => setSkipAllDay(!skipAllDay)} />
							<span className="slider"></span>
						</label>
					</SettingRow>
					<SettingRow icon={Volume2} label="Play a Sound" desc="A soft chime when the bar appears">
						<label className="toggle-switch">
							<input type="checkbox" checked={sound} onChange={() => setSound(!sound)} />
							<span className="slider"></span>
						</label>
					</SettingRow>
				</>
			)}

			<SettingRow
				icon={Eye}
				label="Preview"
				desc={previewSent ? "Look at the top of your screen" : "Shows a made-up reminder with these settings"}
				divider={false}
			>
				<button
					className="reminder-preview-btn"
					onClick={() => {
						emit(REMINDER_PREVIEW_EVENT).catch(() => {});
						setPreviewSent(true);
					}}
				>
					Show preview
				</button>
			</SettingRow>
		</>
	);
}
