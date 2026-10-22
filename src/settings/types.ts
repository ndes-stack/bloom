import type { ComponentType, SVGProps } from "react";

export interface WidgetConfig {
	left: string[];
	right: string[];
}

export type SettingsTab = "general" | "appearance" | "notch" | "dock" | "overlays" | "about";

export interface SettingRowProps {
	icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>;
	label: string;
	desc?: string;
	action?: boolean;
	danger?: boolean;
	divider?: boolean;
	onClick?: () => void;
	children?: React.ReactNode;
}

/** Panels the notch can open to by default. */
export type NotchPanelChoice = "calendar" | "timer" | "launcher" | "command-center";

export function parseNotchPanelChoice(value: unknown): NotchPanelChoice {
	return value === "timer" || value === "launcher" || value === "command-center" ? value : "calendar";
}
