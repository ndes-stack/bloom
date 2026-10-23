// Dock layout options: attached or floating, its own size, and the tablet
// pill. The size factors and the gap must match dock_layout.rs, which sizes
// the strip a fixed dock reserves.

export const DOCK_STYLE_KEY = "bloom-dock-style";
export const DOCK_SIZE_KEY = "bloom-dock-size";
export const DOCK_TABLET_KEY = "bloom-dock-tablet";
export const DOCK_PILL_GLANCE_KEY = "bloom-dock-pill-glance";

export type DockStyle = "attached" | "floating";
export type DockSize = "small" | "medium" | "large";
export type DockTabletMode = "auto" | "always" | "off";

export const DOCK_SIZES: DockSize[] = ["small", "medium", "large"];

export const parseDockStyle = (v: unknown): DockStyle => (v === "floating" ? "floating" : "attached");
export const parseDockSize = (v: unknown): DockSize => (v === "small" || v === "large" ? v : "medium");
export const parseDockTablet = (v: unknown): DockTabletMode => (v === "always" || v === "off" ? v : "auto");

export function dockSizeFactor(size: DockSize): number {
	return size === "small" ? 0.85 : size === "large" ? 1.2 : 1;
}

/** Gap under a floating dock, in px before scaling. */
export const FLOAT_GAP = 12;

/** The tablet dock comes back this much bigger, for fingers. */
export const TOUCH_FACTOR = 1.2;

/** How long the opened tablet dock stays after you stop using it. */
export const PILL_IDLE_MS = 3000;

/** Pixels of Ctrl+drag per size step. */
export const RESIZE_STEP_PX = 36;

/** The size after a Ctrl+drag of `dy` pixels upward from `start`. */
export function sizeAfterDrag(start: DockSize, dy: number): DockSize {
	const from = DOCK_SIZES.indexOf(start);
	const steps = Math.round(dy / RESIZE_STEP_PX);
	const to = Math.min(DOCK_SIZES.length - 1, Math.max(0, from + steps));
	return DOCK_SIZES[to];
}

export const DOCK_SIZE_LABELS: Record<DockSize, string> = { small: "Small", medium: "Medium", large: "Large" };
