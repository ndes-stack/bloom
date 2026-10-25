// Dock material: Solid, Frosted, Glass or Custom, like the notch's (see
// notchMaterial.ts). Linked by default, so the dock follows the notch's
// choice; unlinked, it has its own material, blur and tint.

import {
	NOTCH_BLUR_KEY,
	NOTCH_MATERIAL_KEY,
	NOTCH_TINT_KEY,
	clampNotchBlur,
	clampNotchTint,
	materialLook,
	parseNotchMaterial,
	type MaterialLook,
	type NotchMaterial
} from "./notchMaterial";

export const DOCK_MATERIAL_LINK_KEY = "bloom-dock-material-link";
export const DOCK_MATERIAL_KEY = "bloom-dock-material";
export const DOCK_BLUR_KEY = "bloom-dock-blur";
export const DOCK_TINT_KEY = "bloom-dock-tint";

export const parseMaterialLink = (v: unknown) => v !== false && v !== "false";

export interface MaterialChoice {
	material: NotchMaterial;
	blur: number;
	tint: number;
}

/** The material the dock uses: the notch's while linked, its own otherwise. */
export function dockMaterialLook(link: boolean, notch: MaterialChoice, dock: MaterialChoice): MaterialLook | null {
	const c = link ? notch : dock;
	return materialLook(c.material, c.blur, c.tint);
}

export function readChoice(prefix: "notch" | "dock", read: (key: string) => unknown): MaterialChoice {
	const [m, b, t] =
		prefix === "notch"
			? [NOTCH_MATERIAL_KEY, NOTCH_BLUR_KEY, NOTCH_TINT_KEY]
			: [DOCK_MATERIAL_KEY, DOCK_BLUR_KEY, DOCK_TINT_KEY];
	return { material: parseNotchMaterial(read(m)), blur: clampNotchBlur(read(b)), tint: clampNotchTint(read(t)) };
}

/**
 * How often to refresh the screenshot behind the dock. With a panel open,
 * apps sit behind it, so often. A fixed dock reserves its strip, so only the
 * wallpaper is behind the bar: rarely. Otherwise windows can pass under it.
 */
export function captureInterval(panelOpen: boolean, fixedMode: boolean): number {
	if (panelOpen) return 2000;
	return fixedMode ? 15000 : 3000;
}

/** Panels need a little more tint than the bar so their text stays readable. */
export const panelTint = (tint: number) => Math.min(0.92, tint + 0.2);
