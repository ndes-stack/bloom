// The notch's pages ("panels") and the user's chosen order.
//
// Scrolling and the arrows by the clock move through the pages in this order.
// The order is a setting (Settings > Notch > Page Order), stored as a JSON
// list in bloom-notch-panel-order. Unknown entries are dropped and any page
// missing from a stored list is added back at the end, so a newer version
// with more pages never loses one.

export type NotchPanel = "calendar" | "timer" | "stats" | "launcher" | "command-center" | "devices";

export const DEFAULT_PANEL_ORDER: readonly NotchPanel[] = [
	"calendar",
	"timer",
	"stats",
	"launcher",
	"command-center",
	"devices"
];

export const PANEL_ORDER_KEY = "bloom-notch-panel-order";

export const PANEL_LABELS: Record<NotchPanel, string> = {
	calendar: "Calendar",
	timer: "Timer",
	stats: "Study stats",
	launcher: "Quick Launcher",
	"command-center": "Command Center",
	devices: "Connected devices"
};

export function isNotchPanel(value: unknown): value is NotchPanel {
	return DEFAULT_PANEL_ORDER.includes(value as NotchPanel);
}

export function parsePanelOrder(value: unknown): NotchPanel[] {
	let list: unknown = value;
	if (typeof value === "string") {
		try {
			list = JSON.parse(value);
		} catch {
			list = null;
		}
	}
	const order: NotchPanel[] = [];
	if (Array.isArray(list)) {
		for (const item of list) if (isNotchPanel(item) && !order.includes(item)) order.push(item);
	}
	for (const panel of DEFAULT_PANEL_ORDER) if (!order.includes(panel)) order.push(panel);
	return order;
}

/** One line under each page's name in Settings > Notch > Pages. */
export const PANEL_DESCRIPTIONS: Record<NotchPanel, string> = {
	calendar: "Month view with your linked calendar's events",
	timer: "Focus timer, tagged with the module you're studying",
	stats: "Focus time per module, today and this week",
	launcher: "Pinned apps, files and websites, plus search",
	"command-center": "Quick toggles, sliders and today's next event",
	devices: "Batteries and audio of your connected devices"
};

/** The setting that turns each page on or off. */
export const PANEL_ENABLED_KEYS: Record<NotchPanel, string> = {
	calendar: "bloom-calendar-enabled",
	timer: "bloom-notch-timer-enabled",
	stats: "bloom-notch-stats-enabled",
	launcher: "bloom-notch-launcher-enabled",
	"command-center": "bloom-notch-command-center-enabled",
	devices: "bloom-notch-devices-enabled"
};

/** Pages are on unless turned off, except Connected devices, which is opt-in. */
export const PANEL_ENABLED_DEFAULTS: Record<NotchPanel, boolean> = {
	calendar: true,
	timer: true,
	stats: true,
	launcher: true,
	"command-center": true,
	devices: false
};

/** A page's on/off setting as stored ("true"/"false" or a boolean), or its default. */
export function panelEnabledValue(panel: NotchPanel, raw: unknown): boolean {
	if (raw === true || raw === "true") return true;
	if (raw === false || raw === "false") return false;
	return PANEL_ENABLED_DEFAULTS[panel];
}
