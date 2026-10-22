// Notch material (Settings > Appearance > Notch Material).
//
// "solid" is the normal theme background. The other materials show a blurred
// copy of whatever is behind the open notch under a see-through tint. The
// notch window can't blur the desktop itself (a webview only sees its own
// pixels), so the backend grabs a small screenshot of the area behind the
// notch window (with the notch left out of it) and it is blurred here.

export const NOTCH_MATERIAL_KEY = "bloom-notch-material";
export const NOTCH_BLUR_KEY = "bloom-notch-blur";
export const NOTCH_TINT_KEY = "bloom-notch-tint";

export type NotchMaterial = "solid" | "frosted" | "glass" | "custom";

export const NOTCH_MATERIALS: NotchMaterial[] = ["solid", "frosted", "glass", "custom"];

export const DEFAULT_NOTCH_BLUR = 28;
export const MIN_NOTCH_BLUR = 8;
export const MAX_NOTCH_BLUR = 60;
export const DEFAULT_NOTCH_TINT = 55;
export const MIN_NOTCH_TINT = 10;
export const MAX_NOTCH_TINT = 100;

export interface MaterialLook {
	/** Blur radius in CSS px of the notch. */
	blur: number;
	/** Tint opacity, 0..1. */
	tint: number;
	/** Saturation boost for the blurred backdrop, in percent. */
	saturate: number;
}

export function parseNotchMaterial(value: unknown): NotchMaterial {
	const v = String(value ?? "");
	return (NOTCH_MATERIALS as string[]).includes(v) ? (v as NotchMaterial) : "solid";
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
	const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.round(n)));
}

export const clampNotchBlur = (v: unknown) =>
	clampInt(v, MIN_NOTCH_BLUR, MAX_NOTCH_BLUR, DEFAULT_NOTCH_BLUR);
export const clampNotchTint = (v: unknown) =>
	clampInt(v, MIN_NOTCH_TINT, MAX_NOTCH_TINT, DEFAULT_NOTCH_TINT);

/** What a material looks like, or null for solid. Custom uses the sliders. */
export function materialLook(material: NotchMaterial, blur: number, tint: number): MaterialLook | null {
	switch (material) {
		case "frosted":
			return { blur: 28, tint: 0.55, saturate: 170 };
		case "glass":
			return { blur: 40, tint: 0.3, saturate: 180 };
		case "custom":
			return { blur: clampNotchBlur(blur), tint: clampNotchTint(tint) / 100, saturate: 170 };
		default:
			return null;
	}
}

/**
 * Blurs a backdrop screenshot (any image the browser can decode) for display
 * at `displayWidth` CSS px. Returns an object URL; the caller revokes it.
 * Edges are extended before blurring so the top of the notch, which sits on
 * the screen edge, doesn't fade to transparent.
 */
export async function blurBackdrop(image: Blob, look: MaterialLook, displayWidth: number): Promise<string> {
	const bitmap = await createImageBitmap(image);
	const w = bitmap.width;
	const h = bitmap.height;
	// The screenshot is smaller than the window; scale the radius to match.
	const radius = Math.max(0.5, (look.blur * w) / Math.max(1, displayWidth));
	const pad = Math.ceil(radius * 2.5);

	const padded = document.createElement("canvas");
	padded.width = w + pad * 2;
	padded.height = h + pad * 2;
	const pctx = padded.getContext("2d");
	if (!pctx) throw new Error("no 2d context");
	pctx.drawImage(bitmap, pad, pad);
	// Stretch the outermost rows and columns into the padding.
	pctx.drawImage(bitmap, 0, 0, w, 1, pad, 0, w, pad);
	pctx.drawImage(bitmap, 0, h - 1, w, 1, pad, pad + h, w, pad);
	pctx.drawImage(padded, pad, 0, 1, padded.height, 0, 0, pad, padded.height);
	pctx.drawImage(padded, pad + w - 1, 0, 1, padded.height, pad + w, 0, pad, padded.height);
	bitmap.close();

	const out = document.createElement("canvas");
	out.width = w;
	out.height = h;
	const octx = out.getContext("2d");
	if (!octx) throw new Error("no 2d context");
	octx.filter = `blur(${radius}px) saturate(${look.saturate}%)`;
	octx.drawImage(padded, -pad, -pad);

	const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
	if (!blob) throw new Error("could not encode backdrop");
	return URL.createObjectURL(blob);
}
