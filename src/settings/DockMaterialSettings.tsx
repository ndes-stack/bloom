import { Link2 } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";
import { MaterialPicker } from "./MaterialPicker";
import { clampNotchBlur, clampNotchTint, parseNotchMaterial } from "../notchMaterial";
import {
	DOCK_BLUR_KEY,
	DOCK_MATERIAL_KEY,
	DOCK_MATERIAL_LINK_KEY,
	DOCK_TINT_KEY,
	parseMaterialLink
} from "../dockMaterial";

/**
 * Settings > Dock: the bar's material. Linked (the default) it follows the
 * notch's choice in Appearance; unlinked it gets its own picker. The tray
 * panels and Start follow the dock.
 */
export function DockMaterialSettings() {
	const [linked, setLinked] = useStored(DOCK_MATERIAL_LINK_KEY, parseMaterialLink);
	const [material, setMaterial] = useStored(DOCK_MATERIAL_KEY, parseNotchMaterial);
	const [blur, setBlur] = useStored(DOCK_BLUR_KEY, clampNotchBlur);
	const [tint, setTint] = useStored(DOCK_TINT_KEY, clampNotchTint);
	return (
		<>
			<SettingRow
				icon={Link2}
				label="Match the notch"
				desc={
					linked
						? "The dock, its panels and Start use the notch's material from Appearance"
						: "The dock has its own material, set below"
				}
			>
				<label className="toggle-switch">
					<input type="checkbox" checked={linked} onChange={() => setLinked(!linked)} />
					<span className="slider"></span>
				</label>
			</SettingRow>
			{!linked && (
				<MaterialPicker
					label="Dock material"
					material={material}
					blur={blur}
					tint={tint}
					onMaterial={setMaterial}
					onBlur={setBlur}
					onTint={setTint}
				/>
			)}
		</>
	);
}
