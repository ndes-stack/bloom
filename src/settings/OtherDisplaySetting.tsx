import { Monitor } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";
import { parseBool } from "../reminders";

/**
 * Settings > Notch / Dock: whether resting the mouse on an edge of another
 * display opens the notch (top) or shows the dock (bottom). See remote_edges.rs.
 */
export function OtherDisplaySetting({ settingKey, desc }: { settingKey: string; desc: string }) {
	const [enabled, setEnabled] = useStored(settingKey, (v) => parseBool(v, true));
	return (
		<SettingRow icon={Monitor} label="Other Displays" desc={desc}>
			<label className="toggle-switch">
				<input type="checkbox" checked={enabled} onChange={() => setEnabled(!enabled)} />
				<span className="slider"></span>
			</label>
		</SettingRow>
	);
}
