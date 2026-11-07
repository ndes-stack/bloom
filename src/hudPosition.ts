// Where the volume and brightness HUD shows (Settings > Overlays > Show In): in the
// notch, which is the default, or as the side overlays sliding in from the edges.
export const HUD_POSITION_KEY = "bloom-hud-position";
export type HudPosition = "notch" | "side";
export const parseHudPosition = (v: unknown): HudPosition => (v === "side" ? "side" : "notch");
export const parseOverlayOn = (v: unknown): boolean => v !== "false" && v !== false;
