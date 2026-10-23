import { Clock3, RectangleHorizontal, Scaling, Tablet } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";
import {
	DOCK_PILL_GLANCE_KEY,
	DOCK_SIZE_KEY,
	DOCK_STYLE_KEY,
	DOCK_TABLET_KEY,
	parseDockSize,
	parseDockStyle,
	parseDockTablet,
	type DockSize,
	type DockStyle,
	type DockTabletMode
} from "../dockLayout";
import { parseBool } from "../reminders";

/** Settings > Dock: floating, its own size, and the tablet pill. */
export function DockLayoutSettings() {
	const [style, setStyle] = useStored(DOCK_STYLE_KEY, parseDockStyle);
	const [size, setSize] = useStored(DOCK_SIZE_KEY, parseDockSize);
	const [tablet, setTablet] = useStored(DOCK_TABLET_KEY, parseDockTablet);
	const [glance, setGlance] = useStored(DOCK_PILL_GLANCE_KEY, (v) => parseBool(v, false));
	return (
		<>
			<SettingRow icon={RectangleHorizontal} label="Style" desc="Attached to the screen edge, or floating just above it">
				<select
					className="settings-select"
					value={style}
					onChange={(e) => setStyle(e.target.value as DockStyle)}
				>
					<option value="attached">Attached</option>
					<option value="floating">Floating</option>
				</select>
			</SettingRow>

			<SettingRow icon={Scaling} label="Size" desc="The dock only. You can also hold Ctrl and drag the dock up or down">
				<select className="settings-select" value={size} onChange={(e) => setSize(e.target.value as DockSize)}>
					<option value="small">Small</option>
					<option value="medium">Medium</option>
					<option value="large">Large</option>
				</select>
			</SettingRow>

			<SettingRow
				icon={Tablet}
				label="Tablet Pill"
				desc={
					tablet === "auto"
						? "Folds into a thin pill when you fold the keyboard back. Tap or swipe up to open it"
						: tablet === "always"
							? "Always a thin pill. Tap or swipe up to open it"
							: "Never folds into a pill"
				}
			>
				<select
					className="settings-select"
					value={tablet}
					onChange={(e) => setTablet(e.target.value as DockTabletMode)}
				>
					<option value="auto">Automatic</option>
					<option value="always">Always</option>
					<option value="off">Off</option>
				</select>
			</SettingRow>

			{tablet !== "off" && (
				<SettingRow icon={Clock3} label="Pill Shows Time" desc="The pill shows the time, battery and a notification dot">
					<label className="toggle-switch">
						<input type="checkbox" checked={glance} onChange={() => setGlance(!glance)} />
						<span className="slider"></span>
					</label>
				</SettingRow>
			)}
		</>
	);
}
