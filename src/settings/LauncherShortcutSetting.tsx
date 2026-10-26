import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";
import { parseBool } from "../reminders";
import {
	DEFAULT_LAUNCHER_HOTKEY,
	LAUNCHER_HOTKEY_KEY,
	LAUNCHER_SHORTCUT_KEY,
	hotkeyFromEvent,
	parseLauncherHotkey
} from "../launcherHotkey";

/** Settings > Notch: the shortcut that opens the Quick Launcher, and a recorder to change it. */
export function LauncherShortcutSetting() {
	const [enabled, setEnabled] = useStored(LAUNCHER_SHORTCUT_KEY, (v) => parseBool(v, true));
	const [hotkey, setHotkey] = useStored(LAUNCHER_HOTKEY_KEY, parseLauncherHotkey);
	const [recording, setRecording] = useState(false);
	const [hint, setHint] = useState<string | null>(null);

	useEffect(() => {
		if (!recording) return;
		const onKey = (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.key === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
				setRecording(false);
				setHint(null);
				return;
			}
			const result = hotkeyFromEvent(e);
			if (result === "modifier") return;
			if (result === null) {
				setHint("Add Ctrl, Alt, Shift or Win (or use an F key)");
				return;
			}
			setHotkey(result);
			setRecording(false);
			setHint(null);
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [recording, setHotkey]);

	return (
		<SettingRow
			icon={Keyboard}
			label="Quick Launcher Shortcut"
			desc={
				hint ??
				(recording
					? "Press the new shortcut, or Esc to cancel"
					: "Opens the Quick Launcher; it stays open until Esc or a click somewhere else")
			}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				{enabled && (
					<>
						<button
							type="button"
							className={`shortcut-chip${recording ? " recording" : ""}`}
							onClick={() => {
								setHint(null);
								setRecording(!recording);
							}}
							onBlur={() => setRecording(false)}
						>
							{recording ? "Press keys…" : hotkey.replace(/\+/g, " + ")}
						</button>
						{hotkey !== DEFAULT_LAUNCHER_HOTKEY && !recording && (
							<button
								type="button"
								className="shortcut-reset"
								onClick={() => setHotkey(DEFAULT_LAUNCHER_HOTKEY)}
							>
								Reset
							</button>
						)}
					</>
				)}
				<label className="toggle-switch">
					<input type="checkbox" checked={enabled} onChange={() => setEnabled(!enabled)} />
					<span className="slider"></span>
				</label>
			</div>
		</SettingRow>
	);
}
