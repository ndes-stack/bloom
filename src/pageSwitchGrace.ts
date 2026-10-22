// Grace period after switching notch pages.
//
// Pages have different widths, so switching can shrink the notch out from
// under the mouse, which Bloom would otherwise read as "the pointer left"
// and close the notch. For this long after a switch, leaving is ignored
// unless the pointer stays away (Settings > Notch > Page Switch Grace).

export const PAGE_SWITCH_GRACE_KEY = "bloom-page-switch-grace";
export const DEFAULT_PAGE_SWITCH_GRACE_MS = 800;
export const MAX_PAGE_SWITCH_GRACE_MS = 2000;

export function clampPageSwitchGrace(value: unknown): number {
	const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(n)) return DEFAULT_PAGE_SWITCH_GRACE_MS;
	return Math.min(MAX_PAGE_SWITCH_GRACE_MS, Math.max(0, Math.round(n / 100) * 100));
}
