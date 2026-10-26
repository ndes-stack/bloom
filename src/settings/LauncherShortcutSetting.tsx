import { Keyboard } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";
import { parseBool } from "../reminders";

export const LAUNCHER_SHORTCUT_KEY = "bloom-launcher-shortcut";

/** Settings > Notch: Alt+Space opens the Quick Launcher. */
export function LauncherShortcutSetting() {
	const [enabled, setEnabled] = useStored(LAUNCHER_SHORTCUT_KEY, (v) => parseBool(v, true));
	return (
		<SettingRow
			icon={Keyboard}
			label="Alt+Space Opens Quick Launcher"
			desc="Stays open until you press Esc or click somewhere else"
		>
			<label className="toggle-switch">
				<input type="checkbox" checked={enabled} onChange={() => setEnabled(!enabled)} />
				<span className="slider"></span>
			</label>
		</SettingRow>
	);
}
