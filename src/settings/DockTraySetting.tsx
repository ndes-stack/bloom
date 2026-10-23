import { PanelBottom } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";
import { DOCK_TRAY_KEY } from "../dockTray";
import { parseBool } from "../reminders";

/** Settings > Dock: the tray end (status, clock and notifications). */
export function DockTraySetting() {
	const [enabled, setEnabled] = useStored(DOCK_TRAY_KEY, (v) => parseBool(v, true));
	return (
		<SettingRow
			icon={PanelBottom}
			label="System Tray"
			desc="Wi-Fi, sound, battery, the clock and notifications at the end of the dock"
		>
			<label className="toggle-switch">
				<input type="checkbox" checked={enabled} onChange={() => setEnabled(!enabled)} />
				<span className="slider"></span>
			</label>
		</SettingRow>
	);
}
