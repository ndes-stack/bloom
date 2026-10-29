// The notch's pages ("panels") and the user's chosen order.
//
// Scrolling and the arrows by the clock move through the pages in this order.
// The order is a setting (Settings > Notch > Page Order), stored as a JSON
// list in bloom-notch-panel-order. Unknown entries are dropped and any page
// missing from a stored list is added back at the end, so a newer version
// with more pages never loses one.

export type NotchPanel = "calendar" | "timer" | "launcher" | "command-center" | "devices";

export const DEFAULT_PANEL_ORDER: readonly NotchPanel[] = [
	"calendar",
	"timer",
	"launcher",
	"command-center",
	"devices"
];

export const PANEL_ORDER_KEY = "bloom-notch-panel-order";

export const PANEL_LABELS: Record<NotchPanel, string> = {
	calendar: "Calendar",
	timer: "Timer",
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
