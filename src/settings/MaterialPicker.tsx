import { Aperture, SunDim } from "lucide-react";
import {
	MAX_NOTCH_BLUR,
	MAX_NOTCH_TINT,
	MIN_NOTCH_BLUR,
	MIN_NOTCH_TINT,
	materialLook,
	type NotchMaterial
} from "../notchMaterial";
import { SettingRow } from "./SettingRow";

const MATERIAL_OPTIONS: { value: NotchMaterial; label: string; hint: string }[] = [
	{ value: "solid", label: "Solid", hint: "The theme colour, no blur" },
	{ value: "frosted", label: "Frosted", hint: "Dark tint, strong blur" },
	{ value: "glass", label: "Glass", hint: "Light tint, more see-through" },
	{ value: "custom", label: "Custom", hint: "Pick your own blur and tint" }
];

/** The Solid / Frosted / Glass / Custom picker, plus the Custom sliders. */
export function MaterialPicker({
	label,
	material,
	blur,
	tint,
	onMaterial,
	onBlur,
	onTint
}: {
	/** For screen readers: "Notch material", "Dock material". */
	label: string;
	material: NotchMaterial;
	blur: number;
	tint: number;
	onMaterial: (m: NotchMaterial) => void;
	onBlur: (v: number) => void;
	onTint: (v: number) => void;
}) {
	return (
		<>
			<div className="material-options" role="radiogroup" aria-label={label}>
				{MATERIAL_OPTIONS.map((opt) => {
					const look = materialLook(opt.value, blur, tint);
					const selected = material === opt.value;
					return (
						<button
							key={opt.value}
							role="radio"
							aria-checked={selected}
							className={`material-option ${selected ? "selected" : ""}`}
							onClick={() => onMaterial(opt.value)}
							title={opt.hint}
						>
							<span className="material-preview" aria-hidden="true">
								<span className="material-blob one" />
								<span className="material-blob two" />
								<span className="material-blob three" />
								<span
									className="material-pill"
									style={
										look
											? {
													background: `rgba(16, 16, 20, ${look.tint})`,
													backdropFilter: `blur(${look.blur / 4}px) saturate(${look.saturate}%)`
												}
											: undefined
									}
								/>
							</span>
							<span className="material-label">{opt.label}</span>
						</button>
					);
				})}
			</div>
			{material === "custom" && (
				<>
					<div className="setting-divider" />
					<SettingRow icon={Aperture} label="Blur" desc={`How soft the background looks (${blur}px)`}>
						<input
							type="range"
							min={MIN_NOTCH_BLUR}
							max={MAX_NOTCH_BLUR}
							step="1"
							value={blur}
							onChange={(e) => onBlur(parseInt(e.target.value))}
							className="settings-slider"
						/>
					</SettingRow>
					<SettingRow
						icon={SunDim}
						label="Tint"
						desc={`How much of the background shows through (${tint}% tint)`}
						divider={false}
					>
						<input
							type="range"
							min={MIN_NOTCH_TINT}
							max={MAX_NOTCH_TINT}
							step="1"
							value={tint}
							onChange={(e) => onTint(parseInt(e.target.value))}
							className="settings-slider"
						/>
					</SettingRow>
				</>
			)}
		</>
	);
}
