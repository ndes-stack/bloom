import { Volume2, Sun, ArrowLeftToLine, ArrowRightToLine, PanelTop } from "lucide-react";
import { SettingRow } from "./SettingRow";
import { useStored } from "./useStored";
import { HUD_POSITION_KEY, parseHudPosition } from "../hudPosition";

interface OverlaysTabProps {
	volumeOverlayEnabled: boolean;
	toggleVolumeOverlay: () => void;
	volumeEdgeEnabled: boolean;
	toggleVolumeEdge: () => void;
	brightnessOverlayEnabled: boolean;
	toggleBrightnessOverlay: () => void;
	brightnessEdgeEnabled: boolean;
	toggleBrightnessEdge: () => void;
}

export function OverlaysTab({
	volumeOverlayEnabled,
	toggleVolumeOverlay,
	volumeEdgeEnabled,
	toggleVolumeEdge,
	brightnessOverlayEnabled,
	toggleBrightnessOverlay,
	brightnessEdgeEnabled,
	toggleBrightnessEdge
}: OverlaysTabProps) {
	const [hudPosition, setHudPosition] = useStored(HUD_POSITION_KEY, parseHudPosition);
	return (
		<>
			<div className="setting-group-label">Overlays</div>
			<div className="setting-group">
				<SettingRow icon={PanelTop} label="Show In" desc="Where volume and brightness appear">
					<select
						className="settings-select"
						value={hudPosition}
						onChange={(e) => setHudPosition(parseHudPosition(e.target.value))}
					>
						<option value="notch">Notch</option>
						<option value="side">Side</option>
					</select>
				</SettingRow>

				<SettingRow icon={Volume2} label="Volume HUD" desc="Qapsule volume overlay">
					<label className="toggle-switch">
						<input type="checkbox" checked={volumeOverlayEnabled} onChange={toggleVolumeOverlay} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				{volumeOverlayEnabled && (
					<SettingRow
						icon={ArrowLeftToLine}
						label="Show on Edge Hover"
						desc="Slide in from left edge"
					>
						<label className="toggle-switch">
							<input type="checkbox" checked={volumeEdgeEnabled} onChange={toggleVolumeEdge} />
							<span className="slider"></span>
						</label>
					</SettingRow>
				)}

				<SettingRow icon={Sun} label="Brightness HUD" desc="Qapsule brightness overlay">
					<label className="toggle-switch">
						<input
							type="checkbox"
							checked={brightnessOverlayEnabled}
							onChange={toggleBrightnessOverlay}
						/>
						<span className="slider"></span>
					</label>
				</SettingRow>

				{brightnessOverlayEnabled && (
					<SettingRow
						icon={ArrowRightToLine}
						label="Show on Edge Hover"
						desc="Slide in from right edge"
						divider={false}
					>
						<label className="toggle-switch">
							<input
								type="checkbox"
								checked={brightnessEdgeEnabled}
								onChange={toggleBrightnessEdge}
							/>
							<span className="slider"></span>
						</label>
					</SettingRow>
				)}
			</div>
		</>
	);
}
