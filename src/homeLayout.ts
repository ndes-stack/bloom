// Home page layout (Settings > Notch > Pages): how big the page is and which
// side the music sits on. The smaller sizes leave music out while nothing is
// playing and shrink to fit what is left.
export const HOME_SIZE_KEY = "bloom-home-size";
export const HOME_MUSIC_SIDE_KEY = "bloom-home-music-side";

export type HomeSize = "full" | "compact" | "strip" | "glance";
export type MusicSide = "left" | "right";

export const HOME_SIZES: { value: HomeSize; label: string }[] = [
	{ value: "full", label: "Full" },
	{ value: "compact", label: "Compact" },
	{ value: "strip", label: "Strip" },
	{ value: "glance", label: "Glance" }
];

export const parseHomeSize = (v: unknown): HomeSize =>
	v === "compact" || v === "strip" || v === "glance" ? v : "full";
export const parseMusicSide = (v: unknown): MusicSide => (v === "left" ? "left" : "right");

/** The page's size in the notch, including the 36px top row. */
export function homeDimensions(size: HomeSize, hasMusic: boolean): { width: number; height: number } {
	switch (size) {
		case "compact":
			return { width: hasMusic ? 470 : 300, height: 130 };
		case "strip":
			return { width: hasMusic ? 470 : 340, height: 82 };
		case "glance":
			return { width: 330, height: hasMusic ? 178 : 116 };
		default:
			return { width: 640, height: 186 };
	}
}
