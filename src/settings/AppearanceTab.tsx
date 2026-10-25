import {
	Palette,
	Droplet,
	Contrast,
	Droplets,
	Sun,
	Square,
	Maximize2,
	Sparkles,
	Check,
	Layers
} from "lucide-react";
import type { NotchMaterial } from "../notchMaterial";
import { MaterialPicker } from "./MaterialPicker";
import { SettingRow } from "./SettingRow";
import { ActivityStyleSettings } from "./ActivityStyleSettings";

interface AppearanceTabProps {
	themeMode: string;
	handleThemeModeChange: (mode: string) => void;
	themeColor: string;
	handleThemeColorChange: (color: string) => void;
	themeOpacity: number;
	handleOpacityChange: (val: number) => void;
	themeSaturation: number;
	handleSaturationChange: (val: number) => void;
	themeBrightness: number;
	handleBrightnessChange: (val: number) => void;
	cornersEnabled: boolean;
	toggleCorners: () => void;
	scale: number;
	handleScaleChange: (val: number) => void;
	/** Hex accent, or null to use the theme's own accent. */
	accentColor: string | null;
	handleAccentColorChange: (color: string | null) => void;
	notchMaterial: NotchMaterial;
	handleNotchMaterialChange: (material: NotchMaterial) => void;
	notchBlur: number;
	handleNotchBlurChange: (val: number) => void;
	notchTint: number;
	handleNotchTintChange: (val: number) => void;
}


// Accent presets (Settings > Appearance > Accent Colour).
const ACCENT_PRESETS: { name: string; hex: string }[] = [
	{ name: "Blue", hex: "#0a84ff" },
	{ name: "Indigo", hex: "#5e5ce6" },
	{ name: "Purple", hex: "#bf5af2" },
	{ name: "Pink", hex: "#ff375f" },
	{ name: "Orange", hex: "#ff9f0a" },
	{ name: "Yellow", hex: "#ffd60a" },
	{ name: "Green", hex: "#30d158" },
	{ name: "Teal", hex: "#40c8e0" }
];

export function AppearanceTab({
	themeMode,
	handleThemeModeChange,
	themeColor,
	handleThemeColorChange,
	themeOpacity,
	handleOpacityChange,
	themeSaturation,
	handleSaturationChange,
	themeBrightness,
	handleBrightnessChange,
	cornersEnabled,
	toggleCorners,
	scale,
	handleScaleChange,
	accentColor,
	handleAccentColorChange,
	notchMaterial,
	handleNotchMaterialChange,
	notchBlur,
	handleNotchBlurChange,
	notchTint,
	handleNotchTintChange
}: AppearanceTabProps) {
	const isPreset = accentColor !== null && ACCENT_PRESETS.some((p) => p.hex === accentColor);
	const showCustomColor = themeMode === "custom";
	const showAdvancedSliders = themeMode === "custom" || themeMode === "adaptive";

	return (
		<>
			<div className="setting-group-label">Theme</div>
			<div className="setting-group">
				<SettingRow icon={Palette} label="Theme Mode" desc="Configure visual styling">
					<select
						className="settings-select"
						value={themeMode}
						onChange={(e) => handleThemeModeChange(e.target.value)}
					>
						<option value="system">Automatic (Match Windows)</option>
						<option value="dark">Dark (Translucent)</option>
						<option value="light">Light (Translucent)</option>
						<option value="custom">Custom Color</option>
						<option value="adaptive">Adaptive Accent</option>
					</select>
				</SettingRow>

				<SettingRow
					icon={Sparkles}
					label="Accent Colour"
					desc={
						accentColor === null
							? "Highlights for things that are on · following the theme"
							: "Highlights for things that are on · works with any theme mode"
					}
				>
					<div className="accent-swatches" role="radiogroup" aria-label="Accent colour">
						<button
							role="radio"
							aria-checked={accentColor === null}
							title="Theme default"
							className={`accent-swatch theme-default ${accentColor === null ? "selected" : ""}`}
							onClick={() => handleAccentColorChange(null)}
						>
							{accentColor === null && <Check size={11} strokeWidth={3} />}
						</button>
						{ACCENT_PRESETS.map((p) => (
							<button
								key={p.hex}
								role="radio"
								aria-checked={accentColor === p.hex}
								title={p.name}
								aria-label={p.name}
								className={`accent-swatch ${accentColor === p.hex ? "selected" : ""}`}
								style={{ background: p.hex }}
								onClick={() => handleAccentColorChange(p.hex)}
							>
								{accentColor === p.hex && <Check size={11} strokeWidth={3} className="accent-check" />}
							</button>
						))}
						<label
							className={`accent-swatch custom ${accentColor !== null && !isPreset ? "selected" : ""}`}
							title="Custom colour"
							style={accentColor !== null && !isPreset ? { background: accentColor } : undefined}
						>
							<input
								type="color"
								aria-label="Custom accent colour"
								value={accentColor ?? "#0a84ff"}
								onChange={(e) => handleAccentColorChange(e.target.value)}
							/>
						</label>
					</div>
				</SettingRow>

				{showCustomColor && (
					<SettingRow
						icon={Droplet}
						label="Custom Theme Color"
						desc="Choose layout background color"
					>
						<div className="color-picker-row">
							<input
								type="color"
								value={themeColor}
								onChange={(e) => handleThemeColorChange(e.target.value)}
								className="color-picker-input"
							/>
							<span className="color-picker-label">{themeColor.toUpperCase()}</span>
						</div>
					</SettingRow>
				)}

				<SettingRow
					icon={Contrast}
					label="Background Opacity"
					desc={`Adjust theme transparency (${Math.round(themeOpacity * 100)}%)`}
					divider={showAdvancedSliders}
				>
					<input
						type="range"
						min="0.1"
						max="1.0"
						step="0.05"
						value={themeOpacity}
						onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
						className="settings-slider"
					/>
				</SettingRow>

				{showAdvancedSliders && (
					<>
						<SettingRow
							icon={Droplets}
							label="Color Saturation"
							desc={`Adjust theme color vibrancy (${Math.round(themeSaturation * 100)}%)`}
						>
							<input
								type="range"
								min="0.0"
								max="1.0"
								step="0.02"
								value={themeSaturation}
								onChange={(e) => handleSaturationChange(parseFloat(e.target.value))}
								className="settings-slider"
							/>
						</SettingRow>

						<SettingRow
							icon={Sun}
							label="Background Brightness"
							desc={`Adjust background lightness (${Math.round(themeBrightness * 100)}%)`}
							divider={false}
						>
							<input
								type="range"
								min="0.0"
								max="1.0"
								step="0.02"
								value={themeBrightness}
								onChange={(e) => handleBrightnessChange(parseFloat(e.target.value))}
								className="settings-slider"
							/>
						</SettingRow>
					</>
				)}
			</div>

			<div className="setting-group-label">Notch Material</div>
			<div className="setting-group">
				<SettingRow
					icon={Layers}
					label="Material"
					desc="Blur what's behind the open notch. Needs Windows 10 (2004) or later."
					divider={false}
				/>
				<MaterialPicker
					label="Notch material"
					material={notchMaterial}
					blur={notchBlur}
					tint={notchTint}
					onMaterial={handleNotchMaterialChange}
					onBlur={handleNotchBlurChange}
					onTint={handleNotchTintChange}
				/>
			</div>

			<div className="setting-group-label">Live Activities</div>
			<div className="setting-group">
				<ActivityStyleSettings />
			</div>

			<div className="setting-group-label">Display</div>
			<div className="setting-group">
				<SettingRow icon={Square} label="Screen Corners" desc="Rounded top edges">
					<label className="toggle-switch">
						<input type="checkbox" checked={cornersEnabled} onChange={toggleCorners} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				<SettingRow
					icon={Maximize2}
					label="UI & Font Scale"
					desc={`Adjust desktop size (${Math.round(scale * 100)}%)`}
					divider={false}
				>
					<div className="scale-button-container">
						<button
							onClick={() => handleScaleChange(Math.max(0.8, parseFloat((scale - 0.1).toFixed(1))))}
							disabled={scale <= 0.8}
							className="scale-adjust-btn"
							title="Decrease Scale"
						>
							—
						</button>
						<span className="scale-display-value">{Math.round(scale * 100)}%</span>
						<button
							onClick={() => handleScaleChange(Math.min(1.3, parseFloat((scale + 0.1).toFixed(1))))}
							disabled={scale >= 1.3}
							className="scale-adjust-btn"
							title="Increase Scale"
						>
							+
						</button>
					</div>
				</SettingRow>
			</div>
		</>
	);
}
