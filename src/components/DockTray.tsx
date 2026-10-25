// The tray end of the dock and the three panels it opens: tray apps, quick
// settings, and notifications with the calendar. Bloom draws its own panels
// in place of the Windows flyouts; the Windows ones can't be restyled.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import {
	Accessibility,
	BatteryCharging,
	Bluetooth,
	BluetoothOff,
	Check,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Hourglass,
	Leaf,
	Pause,
	Plane,
	Play,
	Settings,
	SkipBack,
	SkipForward,
	SunMedium,
	Volume1,
	Volume2,
	VolumeX,
	Wifi,
	WifiOff,
	X
} from "lucide-react";
import { WifiPanel } from "./WifiPanel";
import { BluetoothPanel } from "./BluetoothPanel";
import { useCalendarDays, useCalendarEvents } from "../hooks/useCalendarEvents";
import { describeEventTime, isImportantEvent, type CalendarEvent } from "../calendarIcs";
import { isDeadline } from "../reminders";
import { useTrailingThrottle } from "../hooks/useTrailingThrottle";
import {
	FOCUS_TIMER_EVENT,
	TIMER_STATE_EVENT,
	TIMER_STATE_REQUEST_EVENT,
	batteryLine,
	countdownText,
	groupNotifications,
	monthGrid,
	relativeTime,
	sameDay,
	stepFocus,
	trayClock,
	trayDate,
	type BatteryInfo,
	type FocusTimerCommand,
	type NotificationList,
	type TimerBroadcast,
	type TrayNotification,
	type TrayPanelKind
} from "../dockTray";
import { panelTint } from "../dockMaterial";
import "./DockTray.css";

// ---------------------------------------------------------------- status

interface WifiStatus {
	enabled: boolean;
	connected: boolean;
	ssid: string | null;
}

export interface MediaState {
	title: string;
	artist: string;
	is_playing: boolean;
	has_media: boolean;
	artwork?: string[] | null;
}

export interface TrayStatus {
	wifi: WifiStatus | null;
	refreshWifi: () => void;
	setWifi: (w: WifiStatus | null) => void;
	volume: number;
	muted: boolean;
	setVolumeLocal: (v: number, muted: boolean) => void;
	battery: BatteryInfo | null;
	language: { code: string; layouts: number } | null;
	refreshLanguage: () => void;
	notifications: NotificationList;
	setNotifications: (fn: (n: NotificationList) => NotificationList) => void;
	refreshNotifications: () => void;
	now: Date;
}

/** What's playing, for the quick settings panel. Only mounted while it's open. */
function useMediaState(): MediaState | null {
	const [media, setMedia] = useState<MediaState | null>(null);
	useEffect(() => {
		const un = listen<MediaState>("media-update", (e) =>
			setMedia((prev) =>
				prev &&
				prev.title === e.payload.title &&
				prev.artist === e.payload.artist &&
				prev.is_playing === e.payload.is_playing &&
				prev.has_media === e.payload.has_media &&
				prev.artwork?.[0] === e.payload.artwork?.[0]
					? prev
					: e.payload
			)
		);
		// Updates only come on changes, so ask for the current state.
		invoke("request_media_update").catch(() => {});
		return () => {
			un.then((f) => f());
		};
	}, []);
	return media;
}

/**
 * The notch's timer, which the Focus controls show. Only mounted while a
 * panel is open, so the dock doesn't re-render every second otherwise.
 */
function useTimerBroadcast(): TimerBroadcast | null {
	const [timer, setTimer] = useState<TimerBroadcast | null>(null);
	useEffect(() => {
		const un = listen<TimerBroadcast>(TIMER_STATE_EVENT, (e) => setTimer(e.payload));
		emit(TIMER_STATE_REQUEST_EVENT).catch(() => {});
		return () => {
			un.then((f) => f());
		};
	}, []);
	return timer;
}

/**
 * Live state behind the tray buttons. `active` is false while the dock is
 * hidden, which slows the polls down; `notificationsFast` speeds the
 * notification poll up while their panel is open.
 */
export function useTrayStatus(enabled: boolean, active: boolean, notificationsFast: boolean): TrayStatus {
	const [wifi, setWifi] = useState<WifiStatus | null>(null);
	const [volume, setVolume] = useState(0);
	const [muted, setMuted] = useState(false);
	const [battery, setBattery] = useState<BatteryInfo | null>(null);
	const [language, setLanguage] = useState<{ code: string; layouts: number } | null>(null);
	const [notifications, setNotificationsState] = useState<NotificationList>({
		access: "unspecified",
		items: []
	});
	const [now, setNow] = useState(() => new Date());

	const refreshWifi = useCallback(() => {
		invoke<WifiStatus>("get_wifi_status")
			.then(setWifi)
			.catch(() => {});
	}, []);

	const refreshNotifications = useCallback(() => {
		invoke<NotificationList>("notifications_list")
			.then(setNotificationsState)
			.catch(() => setNotificationsState({ access: "unsupported", items: [] }));
	}, []);

	// Clock: tick on the minute boundary.
	useEffect(() => {
		if (!enabled) return;
		let timer: ReturnType<typeof setTimeout>;
		const tick = () => {
			const d = new Date();
			setNow(d);
			timer = setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 20);
		};
		tick();
		return () => clearTimeout(timer);
	}, [enabled]);

	// Wi-Fi, sound, media and the timer: events, plus a slow safety poll.
	useEffect(() => {
		if (!enabled) return;
		refreshWifi();
		invoke<{ volume: number; is_muted: boolean }>("get_volume_state")
			.then((s) => {
				setVolume(s.volume);
				setMuted(s.is_muted);
			})
			.catch(() => {});
		let wifiDebounce: ReturnType<typeof setTimeout> | undefined;
		const subs = [
			listen<{ volume: number; is_muted: boolean }>("volume-change", (e) => {
				setVolume(e.payload.volume);
				setMuted(e.payload.is_muted);
			}),
			listen("wifi-changed", () => {
				clearTimeout(wifiDebounce);
				wifiDebounce = setTimeout(refreshWifi, 300);
			})
		];
		const poll = setInterval(refreshWifi, 15_000);
		return () => {
			clearTimeout(wifiDebounce);
			clearInterval(poll);
			subs.forEach((p) => p.then((f) => f()));
		};
	}, [enabled, refreshWifi]);

	// Battery: Windows has no change event that reaches us, so poll.
	useEffect(() => {
		if (!enabled) return;
		const load = () =>
			invoke<BatteryInfo>("get_battery_details")
				.then(setBattery)
				.catch(() => {});
		load();
		const poll = setInterval(load, active ? 30_000 : 120_000);
		return () => clearInterval(poll);
	}, [enabled, active]);

	// Keyboard language follows the foreground window, so check often while
	// the dock is on screen.
	const refreshLanguage = useCallback(() => {
		invoke<{ code: string; layouts: number }>("get_input_language")
			.then((l) =>
				setLanguage((prev) => (prev?.code === l.code && prev.layouts === l.layouts ? prev : l))
			)
			.catch(() => {});
	}, []);
	useEffect(() => {
		if (!enabled || !active) return;
		refreshLanguage();
		const poll = setInterval(refreshLanguage, 2000);
		return () => clearInterval(poll);
	}, [enabled, active, refreshLanguage]);

	// Notifications: quick while their panel is open, slow otherwise, and
	// slower still when Windows won't share them.
	const access = notifications.access;
	useEffect(() => {
		if (!enabled) return;
		refreshNotifications();
		const ms = notificationsFast ? 3000 : access === "allowed" ? 15_000 : 60_000;
		const poll = setInterval(refreshNotifications, ms);
		return () => clearInterval(poll);
	}, [enabled, notificationsFast, access, refreshNotifications]);

	return {
		wifi,
		refreshWifi,
		setWifi,
		volume,
		muted,
		setVolumeLocal: (v, m) => {
			setVolume(v);
			setMuted(m);
		},
		battery,
		language,
		refreshLanguage,
		notifications,
		setNotifications: setNotificationsState,
		refreshNotifications,
		now
	};
}

// ---------------------------------------------------------------- buttons

function BatteryGlyph({ percent, charging }: { percent: number; charging: boolean }) {
	const low = percent <= 20 && !charging;
	return (
		<span className={`tray-battery${low ? " low" : ""}`} aria-hidden="true">
			<span className="tray-battery-body">
				<span className="tray-battery-fill" style={{ width: `${Math.max(6, percent)}%` }} />
			</span>
			<span className="tray-battery-cap" />
			{charging && <BatteryCharging className="tray-battery-bolt" />}
		</span>
	);
}

function VolumeIcon({ volume, muted }: { volume: number; muted: boolean }) {
	if (muted || volume === 0) return <VolumeX />;
	if (volume < 0.5) return <Volume1 />;
	return <Volume2 />;
}

function WifiIcon({ wifi }: { wifi: WifiStatus | null }) {
	if (!wifi || !wifi.enabled) return <WifiOff />;
	return <Wifi className={wifi.connected ? undefined : "tray-dim"} />;
}

export interface TrayButtonsProps {
	status: TrayStatus;
	open: TrayPanelKind | null;
	onToggle: (kind: TrayPanelKind, button: HTMLElement) => void;
	hasTrayApps: boolean;
	use24h: boolean;
}

const tapSpring = { type: "spring" as const, stiffness: 600, damping: 30 };

export function TrayButtons({ status, open, onToggle, hasTrayApps, use24h }: TrayButtonsProps) {
	const { wifi, volume, muted, battery, language, notifications, now } = status;
	const count = notifications.access === "allowed" ? notifications.items.length : 0;
	const pct = battery?.present && battery.percent != null ? battery.percent : null;
	const statusLabel = [
		wifi?.enabled ? (wifi.connected ? `Wi-Fi ${wifi.ssid ?? "connected"}` : "Wi-Fi not connected") : "Wi-Fi off",
		muted || volume === 0 ? "sound muted" : `volume ${Math.round(volume * 100)}%`,
		pct != null ? `battery ${pct}%${battery?.charging ? " charging" : ""}` : null
	]
		.filter(Boolean)
		.join(", ");

	return (
		<div className="dock-tray" onClick={(e) => e.stopPropagation()}>
			{hasTrayApps && (
				<motion.button
					type="button"
					className={`tray-btn tray-more${open === "apps" ? " open" : ""}`}
					aria-label="Apps running in the background"
					aria-expanded={open === "apps"}
					whileTap={{ scale: 0.92 }}
					transition={tapSpring}
					onClick={(e) => onToggle("apps", e.currentTarget)}
				>
					<motion.span
						className="tray-chevron"
						animate={{ rotate: open === "apps" ? 180 : 0 }}
						transition={{ type: "spring", stiffness: 420, damping: 26 }}
					>
						<ChevronUp />
					</motion.span>
				</motion.button>
			)}

			<motion.button
				type="button"
				className={`tray-btn tray-status${open === "quick" ? " open" : ""}`}
				aria-label={`Quick settings: ${statusLabel}`}
				aria-expanded={open === "quick"}
				whileTap={{ scale: 0.95 }}
				transition={tapSpring}
				onClick={(e) => onToggle("quick", e.currentTarget)}
			>
				<WifiIcon wifi={wifi} />
				<VolumeIcon volume={volume} muted={muted} />
				{pct != null && (
					<span className="tray-battery-wrap">
						<BatteryGlyph percent={pct} charging={!!battery?.charging} />
						<span className="tray-pct">{pct}%</span>
					</span>
				)}
			</motion.button>

			{language && language.layouts > 1 && language.code && (
				<motion.button
					type="button"
					className={`tray-btn tray-lang${open === "lang" ? " open" : ""}`}
					aria-label={`Keyboard language ${language.code}. Change it`}
					aria-expanded={open === "lang"}
					whileTap={{ scale: 0.92 }}
					transition={tapSpring}
					onClick={(e) => onToggle("lang", e.currentTarget)}
				>
					{language.code}
				</motion.button>
			)}

			<motion.button
				type="button"
				className={`tray-btn tray-clock${open === "calendar" ? " open" : ""}`}
				aria-label={`${now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}, ${trayClock(now, use24h)}${count ? `, ${count} notifications` : ""}`}
				aria-expanded={open === "calendar"}
				whileTap={{ scale: 0.95 }}
				transition={tapSpring}
				onClick={(e) => onToggle("calendar", e.currentTarget)}
			>
				<b>{trayClock(now, use24h)}</b>
				<span>{trayDate(now)}</span>
				<AnimatePresence>
					{count > 0 && (
						<motion.span
							key="badge"
							className="tray-badge"
							initial={{ scale: 0, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0, opacity: 0 }}
							transition={{ type: "spring", stiffness: 520, damping: 22 }}
						>
							<AnimatePresence mode="popLayout" initial={false}>
								<motion.span
									key={count}
									initial={{ y: -8, opacity: 0 }}
									animate={{ y: 0, opacity: 1 }}
									exit={{ y: 8, opacity: 0 }}
									transition={{ duration: 0.16 }}
								>
									{count > 99 ? "99+" : count}
								</motion.span>
							</AnimatePresence>
						</motion.span>
					)}
				</AnimatePresence>
			</motion.button>
		</div>
	);
}

// ---------------------------------------------------------------- panel host

/** Widest each panel gets, for keeping it on screen. */
export const PANEL_WIDTHS: Record<TrayPanelKind, number> = {
	apps: 260,
	quick: 360,
	lang: 320,
	start: 560,
	calendar: 720
};

/** The widest any panel gets. */
export const PANEL_MAX_WIDTH = Math.max(...Object.values(PANEL_WIDTHS));

/** Where the open panel sits, in visual (zoomed) viewport pixels. */
export interface PanelAnchor {
	/** Distance from the viewport's right edge to the panel's right edge. */
	right: number;
	/** Distance from the viewport's bottom edge to the panel's bottom edge. */
	bottom: number;
	/** The button's centre, measured from the viewport's right edge. */
	buttonCenterFromRight: number;
	/** Tallest the panel may be, in visual pixels. */
	maxHeight: number;
}

export interface PanelRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

// Critically damped, so the panel settles without a wobble.
const panelSpring = { type: "spring" as const, stiffness: 520, damping: 44, mass: 1 };
// Size changes ease rather than spring: a springy width or height makes the
// blurred surface repaint at odd sizes and reads as jitter.
const morphEase = { duration: 0.32, ease: [0.32, 0.72, 0, 1] as const };

/**
 * Hosts whichever panel is open. Switching panels morphs the one surface to
 * the new size instead of closing and reopening; contents cross-fade inside.
 */
export function TrayPanelHost({
	kind,
	anchor,
	scale,
	onClose,
	onRect,
	render,
	backdrop = null,
	backdropTint = 1
}: {
	kind: TrayPanelKind;
	anchor: PanelAnchor;
	scale: number;
	onClose: () => void;
	onRect: (rect: PanelRect | null) => void;
	render: (kind: TrayPanelKind) => React.ReactNode;
	/** Blurred screenshot of the dock window's area, laid behind the panel. */
	backdrop?: string | null;
	backdropTint?: number;
}) {
	const [sizes, setSizes] = useState<Partial<Record<TrayPanelKind, { w: number; h: number }>>>({});
	const size = sizes[kind];
	const width = size?.w;
	const height = size?.h;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	// Report the panel's settled box for the window region and click handling.
	useEffect(() => {
		if (height == null || width == null) return;
		const w = width * scale;
		const h = height * scale;
		onRect({
			x: window.innerWidth - anchor.right - w,
			y: window.innerHeight - anchor.bottom - h,
			width: w,
			height: h
		});
	}, [width, height, scale, anchor.right, anchor.bottom, onRect]);
	useEffect(() => () => onRect(null), [onRect]);

	const report = useCallback((k: TrayPanelKind, w: number, h: number) => {
		setSizes((prev) => (prev[k]?.w === w && prev[k]?.h === h ? prev : { ...prev, [k]: { w, h } }));
	}, []);

	// Grow out of the button that opened it.
	const fromRight = (anchor.buttonCenterFromRight - anchor.right) / scale;
	const transformOrigin = `calc(100% - ${Math.max(0, fromRight)}px) 100%`;

	return (
		<div
			className="tray-panel-anchor"
			style={{ zoom: scale, right: anchor.right / scale, bottom: anchor.bottom / scale }}
		>
			<motion.div
				className="tray-panel"
				role="dialog"
				initial={{ opacity: 0, y: 12, scale: 0.97, width: width ?? "auto", height: height ?? "auto" }}
				animate={{ opacity: 1, y: 0, scale: 1, width: width ?? "auto", height: height ?? "auto" }}
				exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
				transition={{
					opacity: { duration: 0.18, ease: "easeOut" },
					y: panelSpring,
					scale: panelSpring,
					width: morphEase,
					height: morphEase
				}}
				style={{
					transformOrigin,
					maxHeight: anchor.maxHeight / scale,
					...(backdrop ? panelBackdropStyle(backdrop, backdropTint, anchor, scale) : {})
				}}
				onClick={(e) => e.stopPropagation()}
				onContextMenu={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
			>
				<AnimatePresence initial={false}>
					<motion.div
						key={kind}
						className="tray-panel-content"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, transition: { duration: 0.1 } }}
						transition={{ duration: 0.22, delay: 0.08, ease: "easeOut" }}
					>
						<Measure kind={kind} onHeight={report}>
							{render(kind)}
						</Measure>
					</motion.div>
				</AnimatePresence>
			</motion.div>
		</div>
	);
}

function Measure({
	kind,
	onHeight,
	children
}: {
	kind: TrayPanelKind;
	onHeight: (kind: TrayPanelKind, w: number, h: number) => void;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const send = () => onHeight(kind, el.offsetWidth, el.offsetHeight);
		send();
		const ro = new ResizeObserver(send);
		ro.observe(el);
		return () => ro.disconnect();
	}, [kind, onHeight]);
	return <div ref={ref}>{children}</div>;
}

/**
 * The dock's blurred screenshot, placed so it lines up with the screen behind
 * the panel: it covers the whole window, and the panel's right and bottom
 * edges are `anchor.right` and `anchor.bottom` (on screen) from the window's.
 * Sizes are in the panel's own px, which CSS zoom scales by `scale`.
 */
function panelBackdropStyle(url: string, tint: number, anchor: PanelAnchor, scale: number): React.CSSProperties {
	const veil = `rgb(from var(--bloom-bg-expanded) r g b / ${panelTint(tint)})`;
	return {
		backgroundColor: "transparent",
		backgroundImage: `linear-gradient(${veil}, ${veil}), url("${url}")`,
		backgroundSize: `auto, ${window.innerWidth / scale}px ${window.innerHeight / scale}px`,
		backgroundPosition: `0 0, calc(100% + ${anchor.right / scale}px) calc(100% + ${anchor.bottom / scale}px)`,
		backgroundRepeat: "no-repeat",
		backgroundOrigin: "border-box",
		backdropFilter: "none"
	};
}

/** Respects Windows' "Animation effects" setting through prefers-reduced-motion. */
export function TrayMotion({ children }: { children: React.ReactNode }) {
	return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

// ---------------------------------------------------------------- apps panel

export interface TrayAppEntry {
	name: string;
	path: string;
	tray_ids: string[];
}

export function TrayAppsPanel({
	apps,
	icons,
	onOpen,
	onMenu
}: {
	apps: TrayAppEntry[];
	icons: Record<string, string>;
	onOpen: (app: TrayAppEntry) => void;
	onMenu: (app: TrayAppEntry) => void;
}) {
	const [hovered, setHovered] = useState<string | null>(null);
	return (
		<div className="tp tp-apps">
			<div className="tp-apps-grid">
				{apps.map((app, i) => (
					<motion.button
						type="button"
						key={app.path + i}
						className="tp-app"
						aria-label={app.name}
						initial={{ opacity: 0, y: 6, scale: 0.9 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{ type: "spring", stiffness: 500, damping: 30, delay: 0.03 * i }}
						whileTap={{ scale: 0.9 }}
						onMouseEnter={() => setHovered(app.name)}
						onMouseLeave={() => setHovered(null)}
						onClick={() => onOpen(app)}
						onContextMenu={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onMenu(app);
						}}
					>
						{icons[app.path] ? (
							<img src={icons[app.path]} alt="" draggable={false} />
						) : (
							<span className="tp-app-fallback">{app.name[0]}</span>
						)}
					</motion.button>
				))}
			</div>
			<div className="tp-apps-caption">
				<AnimatePresence mode="wait" initial={false}>
					<motion.span
						key={hovered ?? "-"}
						initial={{ opacity: 0, y: 3 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -3 }}
						transition={{ duration: 0.12 }}
					>
						{hovered ?? (apps.length ? "Running in the background" : "Nothing in the tray")}
					</motion.span>
				</AnimatePresence>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------- keyboard language

interface InputLayout {
	id: string;
	code: string;
	name: string;
	active: boolean;
}

export function LanguagePanel({ onChanged }: { onChanged: () => void }) {
	const [layouts, setLayouts] = useState<InputLayout[] | null>(null);
	const load = useCallback(() => {
		invoke<InputLayout[]>("get_input_languages")
			.then((l) => setLayouts(l ?? []))
			.catch(() => setLayouts([]));
	}, []);
	useEffect(() => {
		load();
		const poll = setInterval(load, 2000);
		return () => clearInterval(poll);
	}, [load]);

	const pick = (layout: InputLayout) => {
		setLayouts((prev) => prev?.map((l) => ({ ...l, active: l.id === layout.id })) ?? prev);
		invoke("set_input_language", { id: layout.id })
			.catch(() => {})
			.finally(() => {
				setTimeout(() => {
					load();
					onChanged();
				}, 250);
			});
	};

	// Two layouts for one language get numbered so they can be told apart.
	const counts = new Map<string, number>();
	return (
		<div className="tp tp-lang">
			<div className="tl-header">
				<b>Keyboard</b>
				<span>Applies to the app you're using</span>
			</div>
			<div className="tl-list">
				{(layouts ?? []).map((l, i) => {
					const n = (counts.get(l.name) ?? 0) + 1;
					counts.set(l.name, n);
					const dupes = (layouts ?? []).filter((x) => x.name === l.name).length > 1;
					return (
						<motion.button
							type="button"
							key={l.id}
							className={`tl-row${l.active ? " active" : ""}`}
							aria-pressed={l.active}
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.18, delay: 0.03 * i }}
							whileTap={{ scale: 0.98 }}
							onClick={() => pick(l)}
						>
							<span className="tl-code">{l.code || "?"}</span>
							<span className="tl-name">
								{l.name || "Keyboard"}
								{dupes ? ` · ${n}` : ""}
							</span>
							<AnimatePresence>
								{l.active && (
									<motion.span
										className="tl-check"
										initial={{ scale: 0 }}
										animate={{ scale: 1 }}
										exit={{ scale: 0 }}
										transition={{ type: "spring", stiffness: 500, damping: 28 }}
									>
										<Check />
									</motion.span>
								)}
							</AnimatePresence>
						</motion.button>
					);
				})}
				{layouts && layouts.length === 0 && <div className="ta-empty">No keyboard languages found</div>}
			</div>
			<div className="tp-footer">
				<span className="tp-footer-battery">Win+Space switches too</span>
				<button
					type="button"
					className="tp-chip"
					onClick={() => invoke("open_system_action", { action: "language-settings" }).catch(() => {})}
				>
					Language settings
				</button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------- quick settings

function Slider({
	value,
	max,
	step,
	label,
	onChange
}: {
	value: number;
	max: number;
	step: number;
	label: string;
	onChange: (v: number) => void;
}) {
	const pct = max > 0 ? (value / max) * 100 : 0;
	return (
		<input
			type="range"
			className="tp-slider"
			min={0}
			max={max}
			step={step}
			value={value}
			aria-label={label}
			style={{ "--fill": `${pct}%` } as React.CSSProperties}
			onChange={(e) => onChange(parseFloat(e.target.value))}
		/>
	);
}

function SplitTile({
	on,
	icon,
	label,
	sub,
	onToggle,
	onMore,
	moreLabel
}: {
	on: boolean;
	icon: React.ReactNode;
	label: string;
	sub: string;
	onToggle: () => void;
	onMore: () => void;
	moreLabel: string;
}) {
	return (
		<div className={`tp-split${on ? " on" : ""}`}>
			<motion.button
				type="button"
				className="tp-split-main"
				aria-pressed={on}
				whileTap={{ scale: 0.97 }}
				onClick={onToggle}
			>
				<span className="tp-split-icon">{icon}</span>
				<span className="tp-split-text">
					<b>{label}</b>
					<span>{sub}</span>
				</span>
			</motion.button>
			<button type="button" className="tp-split-more" aria-label={moreLabel} onClick={onMore}>
				<ChevronRight />
			</button>
		</div>
	);
}

function SmallTile({
	on,
	icon,
	label,
	onClick
}: {
	on?: boolean;
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
}) {
	return (
		<div className="tp-small">
			<motion.button
				type="button"
				className={`tp-small-btn${on ? " on" : ""}`}
				aria-label={label}
				aria-pressed={on}
				whileTap={{ scale: 0.92 }}
				onClick={onClick}
			>
				{icon}
			</motion.button>
			<span>{label}</span>
		</div>
	);
}

const subSlide = {
	initial: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	animate: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 })
};

export function QuickSettingsPanel({
	status,
	focusMinutes,
	onFocus
}: {
	status: TrayStatus;
	focusMinutes: number;
	onFocus: (cmd: FocusTimerCommand) => void;
}) {
	const { wifi, refreshWifi, setWifi, volume, muted, setVolumeLocal, battery } = status;
	const media = useMediaState();
	const timer = useTimerBroadcast();
	const [sub, setSub] = useState<"wifi" | "bluetooth" | null>(null);
	const [bluetooth, setBluetooth] = useState<boolean>(false);
	const [btNames, setBtNames] = useState<string[]>([]);
	const [brightness, setBrightness] = useState(0);
	const [saver, setSaver] = useState(false);
	const lastVolume = useRef(volume || 0.5);

	useEffect(() => {
		invoke<boolean>("get_bluetooth_state")
			.then(setBluetooth)
			.catch(() => {});
		invoke<number>("get_brightness")
			.then(setBrightness)
			.catch(() => {});
		invoke<boolean>("get_battery_saver_state")
			.then(setSaver)
			.catch(() => {});
		const subs = [listen<{ brightness: number }>("brightness-change", (e) => setBrightness(e.payload.brightness))];
		const poll = setInterval(() => {
			invoke<boolean>("get_battery_saver_state")
				.then(setSaver)
				.catch(() => {});
		}, 5000);
		return () => {
			clearInterval(poll);
			subs.forEach((p) => p.then((f) => f()));
		};
	}, []);

	useEffect(() => {
		if (!bluetooth) {
			setBtNames([]);
			return;
		}
		const load = () =>
			invoke<{ name: string; connected: boolean }[]>("bluetooth_list_devices")
				.then((d) => setBtNames(d.filter((x) => x.connected).map((x) => x.name)))
				.catch(() => {});
		load();
		const un = listen("bluetooth-changed", () => setTimeout(load, 400));
		return () => {
			un.then((f) => f());
		};
	}, [bluetooth]);

	useEffect(() => {
		if (volume > 0 && !muted) lastVolume.current = volume;
	}, [volume, muted]);

	const sendVolume = useTrailingThrottle((v: number) => {
		invoke("set_volume", { volume: v }).catch(() => {});
	}, 50);
	const sendBrightness = useTrailingThrottle((v: number) => {
		invoke("set_brightness", { brightness: Math.round(v) }).catch(() => {});
	}, 50);

	const toggleWifi = async () => {
		const next = !(wifi?.enabled ?? false);
		const prev = wifi;
		setWifi({ enabled: next, connected: next ? (wifi?.connected ?? false) : false, ssid: next ? (wifi?.ssid ?? null) : null });
		try {
			await invoke("set_wifi_state", { enabled: next });
			setTimeout(refreshWifi, 800);
		} catch {
			setWifi(prev);
		}
	};

	const toggleBluetooth = async () => {
		const next = !bluetooth;
		setBluetooth(next);
		try {
			await invoke("set_bluetooth_state", { enabled: next });
		} catch {
			setBluetooth(!next);
		}
	};

	const toggleMute = () => {
		if (muted || volume === 0) {
			const v = volume === 0 ? lastVolume.current : volume;
			setVolumeLocal(v, false);
			if (volume === 0) sendVolume(v);
			else invoke("set_master_mute", { muted: false }).catch(() => {});
		} else {
			setVolumeLocal(volume, true);
			invoke("set_master_mute", { muted: true }).catch(() => {});
		}
	};

	const focusRunning = !!timer && timer.seconds > 0 && !timer.finished;
	const dir = sub ? 1 : -1;
	const wifiSub = !wifi?.enabled ? "Off" : wifi.connected ? (wifi.ssid ?? "Connected") : "Not connected";
	const btSub = !bluetooth ? "Off" : btNames.length ? btNames.join(", ") : "Not connected";
	const art = media?.artwork?.[0];
	const displayVolume = muted ? 0 : volume;

	return (
		<div className="tp tp-quick">
			<AnimatePresence mode="popLayout" initial={false} custom={dir}>
				{sub === null ? (
					<motion.div
						key="main"
						className="tp-quick-main"
						custom={dir}
						variants={subSlide}
						initial="initial"
						animate="animate"
						exit="exit"
						transition={{ type: "spring", stiffness: 420, damping: 36 }}
					>
						<div className="tp-split-row">
							<SplitTile
								on={!!wifi?.enabled}
								icon={<WifiIcon wifi={wifi} />}
								label="Wi-Fi"
								sub={wifiSub}
								onToggle={toggleWifi}
								onMore={() => setSub("wifi")}
								moreLabel="Choose a Wi-Fi network"
							/>
							<SplitTile
								on={bluetooth}
								icon={bluetooth ? <Bluetooth /> : <BluetoothOff />}
								label="Bluetooth"
								sub={btSub}
								onToggle={toggleBluetooth}
								onMore={() => setSub("bluetooth")}
								moreLabel="Bluetooth devices"
							/>
						</div>

						<div className="tp-small-row">
							<SmallTile
								icon={<Plane />}
								label="Flight mode"
								onClick={() => invoke("open_airplane_mode_settings").catch(() => {})}
							/>
							<SmallTile
								on={focusRunning}
								icon={<Hourglass />}
								label={focusRunning ? countdownText(timer!.seconds) : "Focus"}
								onClick={() =>
									onFocus(focusRunning ? { action: "stop" } : { action: "start", seconds: focusMinutes * 60 })
								}
							/>
							<SmallTile
								on={saver}
								icon={<Leaf />}
								label="Energy saver"
								onClick={() => invoke("open_battery_saver_settings").catch(() => {})}
							/>
							<SmallTile
								icon={<Accessibility />}
								label="Accessibility"
								onClick={() => invoke("open_system_action", { action: "accessibility" }).catch(() => {})}
							/>
						</div>

						<div className="tp-sliders">
							<div className="tp-slider-row">
								<span className="tp-slider-icon" aria-hidden="true">
									<SunMedium />
								</span>
								<Slider
									value={brightness}
									max={100}
									step={1}
									label="Brightness"
									onChange={(v) => {
										setBrightness(v);
										sendBrightness(v);
									}}
								/>
							</div>
							<div className="tp-slider-row">
								<button
									type="button"
									className="tp-slider-icon tp-mute"
									aria-label={muted ? "Unmute" : "Mute"}
									onClick={toggleMute}
								>
									<VolumeIcon volume={volume} muted={muted} />
								</button>
								<Slider
									value={displayVolume}
									max={1}
									step={0.01}
									label="Volume"
									onChange={(v) => {
										setVolumeLocal(v, v === 0);
										sendVolume(v);
									}}
								/>
								<button
									type="button"
									className="tp-slider-more"
									aria-label="Sound settings"
									onClick={() => invoke("open_system_action", { action: "sound-settings" }).catch(() => {})}
								>
									<ChevronRight />
								</button>
							</div>
						</div>

						<AnimatePresence initial={false}>
							{media?.has_media && (
								<motion.div
									key="media"
									className="tp-media"
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: "auto" }}
									exit={{ opacity: 0, height: 0 }}
									transition={{ type: "spring", stiffness: 380, damping: 34 }}
								>
									<div className="tp-media-inner">
										<span className="tp-media-art">{art ? <img src={art} alt="" /> : null}</span>
										<span className="tp-media-text">
											<b>{media.title || "Playing"}</b>
											<span>{media.artist}</span>
										</span>
										<button type="button" aria-label="Previous" onClick={() => invoke("media_previous").catch(() => {})}>
											<SkipBack />
										</button>
										<motion.button
											type="button"
											className="tp-media-play"
											aria-label={media.is_playing ? "Pause" : "Play"}
											whileTap={{ scale: 0.88 }}
											onClick={() => invoke("media_play_pause").catch(() => {})}
										>
											{media.is_playing ? <Pause /> : <Play />}
										</motion.button>
										<button type="button" aria-label="Next" onClick={() => invoke("media_next").catch(() => {})}>
											<SkipForward />
										</button>
									</div>
								</motion.div>
							)}
						</AnimatePresence>

						<div className="tp-footer">
							<span className="tp-footer-battery">
								{battery?.present && battery.percent != null && (
									<BatteryGlyph percent={battery.percent} charging={battery.charging} />
								)}
								{batteryLine(battery)}
							</span>
							<button
								type="button"
								aria-label="All settings"
								onClick={() => invoke("open_system_action", { action: "settings" }).catch(() => {})}
							>
								<Settings />
							</button>
						</div>
					</motion.div>
				) : (
					<motion.div
						key={sub}
						className="tp-quick-sub"
						custom={dir}
						variants={subSlide}
						initial="initial"
						animate="animate"
						exit="exit"
						transition={{ type: "spring", stiffness: 420, damping: 36 }}
					>
						{sub === "wifi" ? (
							<WifiPanel
								enabled={!!wifi?.enabled}
								onToggle={toggleWifi}
								onBack={() => setSub(null)}
								onPinChange={() => {}}
							/>
						) : (
							<BluetoothPanel
								enabled={bluetooth}
								onToggle={toggleBluetooth}
								onBack={() => setSub(null)}
								onPinChange={() => {}}
							/>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

// ---------------------------------------------------------------- notifications + calendar

function NotificationCard({
	group,
	icon,
	now,
	onOpen,
	onDismiss
}: {
	group: ReturnType<typeof groupNotifications>[number];
	icon: string | undefined;
	now: number;
	onOpen: (n: TrayNotification) => void;
	onDismiss: (ids: number[]) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const shown = expanded ? group.items : group.items.slice(0, 1);
	const more = group.items.length - 1;
	return (
		<motion.div
			layout
			className="tn-group"
			initial={{ opacity: 0, y: -10, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, x: 60, transition: { duration: 0.18 } }}
			transition={{ type: "spring", stiffness: 420, damping: 34 }}
			drag="x"
			dragConstraints={{ left: 0, right: 0 }}
			dragElastic={{ left: 0.05, right: 0.6 }}
			onDragEnd={(_, info) => {
				if (info.offset.x > 90 || info.velocity.x > 600) onDismiss(group.items.map((n) => n.id));
			}}
		>
			<div className="tn-head">
				<span className="tn-icon">{icon ? <img src={icon} alt="" draggable={false} /> : group.appName[0]}</span>
				<b>{group.appName}</b>
				{more > 0 && <span className="tn-count">{group.items.length}</span>}
				<span className="tn-time">{relativeTime(group.items[0].time, now)}</span>
				<button
					type="button"
					className="tn-x"
					aria-label={`Dismiss ${group.appName} notifications`}
					onClick={() => onDismiss(group.items.map((n) => n.id))}
				>
					<X />
				</button>
			</div>
			<AnimatePresence initial={false}>
				{shown.map((n) => (
					<motion.button
						type="button"
						key={n.id}
						layout="position"
						className="tn-item"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ type: "spring", stiffness: 420, damping: 36 }}
						onClick={() => onOpen(n)}
					>
						{n.title && <b>{n.title}</b>}
						{n.body && <span>{n.body}</span>}
					</motion.button>
				))}
			</AnimatePresence>
			{more > 0 && (
				<button type="button" className="tn-more" onClick={() => setExpanded((v) => !v)}>
					{expanded ? "Show less" : `+${more} more`}
				</button>
			)}
		</motion.div>
	);
}

function NotificationsSection({
	status,
	icons,
	column
}: {
	status: TrayStatus;
	icons: Record<string, string>;
	/** Its own column beside the calendar, rather than a line above it. */
	column: boolean;
}) {
	const { notifications, setNotifications, refreshNotifications, now } = status;
	const groups = useMemo(() => groupNotifications(notifications.items), [notifications.items]);

	const dismiss = (ids: number[]) => {
		setNotifications((n) => ({ ...n, items: n.items.filter((i) => !ids.includes(i.id)) }));
		ids.forEach((id) => invoke("notifications_remove", { id }).catch(() => {}));
	};
	const clearAll = () => {
		setNotifications((n) => ({ ...n, items: [] }));
		invoke("notifications_clear").catch(() => {});
	};
	const open = (n: TrayNotification) => {
		if (n.app_id) invoke("open_app", { appName: n.app_id }).catch(() => {});
		dismiss([n.id]);
	};
	const requestAccess = async () => {
		await invoke("notifications_request_access").catch(() => {});
		refreshNotifications();
	};

	const access = notifications.access;
	return (
		<section className={`tn${column ? " tn-column" : " tn-compact"}`}>
			<div className="tn-header">
				<b>Notifications</b>
				{access === "allowed" && groups.length === 0 && <span className="tn-none">None new</span>}
				{access === "allowed" && groups.length > 0 && (
					<button type="button" className="tp-chip" onClick={clearAll}>
						Clear all
					</button>
				)}
				{access === "unspecified" && (
					<>
						<span className="tn-none">Show them here</span>
						<button type="button" className="tp-chip accent" onClick={requestAccess}>
							Allow
						</button>
					</>
				)}
				{access === "denied" && <span className="tn-none">Access is off</span>}
				{access === "unsupported" && (
					<>
						<span className="tn-none">Not shared by Windows</span>
						<button
							type="button"
							className="tp-chip"
							onClick={() => invoke("open_notification_center").catch(() => {})}
						>
							Open
						</button>
					</>
				)}
				<button
					type="button"
					className="tp-icon-btn"
					aria-label="Notification settings"
					onClick={() => invoke("open_system_action", { action: "notification-settings" }).catch(() => {})}
				>
					<Settings />
				</button>
			</div>

			{access === "allowed" && groups.length > 0 && (
				<div className="tn-list">
					<AnimatePresence initial={false}>
						{groups.map((g) => (
							<NotificationCard
								key={g.appId || g.appName}
								group={g}
								icon={g.appId ? icons[g.appId] : undefined}
								now={now.getTime()}
								onOpen={open}
								onDismiss={dismiss}
							/>
						))}
					</AnimatePresence>
				</div>
			)}
		</section>
	);
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function AgendaRow({ ev, day, now }: { ev: CalendarEvent; day: Date; now: Date }) {
	const live = !ev.allDay && ev.start <= now && now < ev.end;
	const important = isImportantEvent(ev) || isDeadline(ev.title);
	const time = live
		? `Now · until ${ev.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
		: describeEventTime(ev, day);
	return (
		<motion.div
			layout="position"
			className={`ta-row${live ? " live" : ""}${important ? " important" : ""}`}
			initial={{ opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.18 }}
		>
			<span className="ta-bar" />
			<span className="ta-text">
				<b>{ev.title}</b>
				<span>
					{time}
					{ev.location ? ` · ${ev.location}` : ""}
				</span>
			</span>
		</motion.div>
	);
}

export function CalendarPanel({
	status,
	icons,
	focusMinutes,
	setFocusMinutes,
	onFocus,
	onOpenBloomSettings
}: {
	status: TrayStatus;
	icons: Record<string, string>;
	focusMinutes: number;
	setFocusMinutes: (m: number) => void;
	onFocus: (cmd: FocusTimerCommand) => void;
	onOpenBloomSettings: () => void;
}) {
	const { now } = status;
	const timer = useTimerBroadcast();
	const [selected, setSelected] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
	const [view, setView] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }));
	const [dir, setDir] = useState(0);
	const { byDay, status: feedStatus } = useCalendarEvents(view.year, view.month);
	const { days } = useCalendarDays(selected, 1);
	const agenda = days[0] ?? [];
	const cells = useMemo(() => monthGrid(view.year, view.month), [view.year, view.month]);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	const shiftMonth = (delta: number) => {
		setDir(delta);
		setView((v) => {
			const d = new Date(v.year, v.month + delta, 1);
			return { year: d.getFullYear(), month: d.getMonth() };
		});
	};
	const goToday = () => {
		setDir(today.getTime() < new Date(view.year, view.month, 1).getTime() ? -1 : 1);
		setView({ year: today.getFullYear(), month: today.getMonth() });
		setSelected(today);
	};
	const pick = (date: Date) => {
		if (date.getMonth() !== view.month) shiftMonth(date < new Date(view.year, view.month, 1) ? -1 : 1);
		setSelected(date);
	};

	const focusActive = !!timer && timer.seconds > 0 && !timer.finished;
	// Notifications get their own column only when there are some to show;
	// otherwise they fold into one line above the calendar.
	const twoColumns = status.notifications.access === "allowed" && status.notifications.items.length > 0;
	const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString([], { month: "long", year: "numeric" });
	const isSelectedToday = sameDay(selected, today);
	// Six-week months take a row of the agenda, so the panel fits above the dock.
	const agendaRows = cells.length > 35 ? 2 : 3;

	return (
		<div className={`tp tp-calendar${twoColumns ? " two" : ""}`}>
			{twoColumns && <NotificationsSection status={status} icons={icons} column />}
			<div className="tc-col">
			{!twoColumns && <NotificationsSection status={status} icons={icons} column={false} />}

			<section className="tc">
				<div className="tc-header">
					<button type="button" className="tc-title" onClick={goToday} aria-label="Go to today">
						<b>
							{selected.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
						</b>
						<span>{monthLabel}</span>
					</button>
					<button type="button" className="tp-icon-btn" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
						<ChevronLeft />
					</button>
					<button type="button" className="tp-icon-btn" aria-label="Next month" onClick={() => shiftMonth(1)}>
						<ChevronRight />
					</button>
				</div>

				<div className="tc-weekdays">
					{WEEKDAYS.map((d) => (
						<span key={d}>{d}</span>
					))}
				</div>
				<div className="tc-grid-clip">
					<AnimatePresence mode="popLayout" initial={false} custom={dir}>
						<motion.div
							key={`${view.year}-${view.month}`}
							className="tc-grid"
							custom={dir}
							variants={{
								initial: (d: number) => ({ opacity: 0, x: d * 40 }),
								animate: { opacity: 1, x: 0 },
								exit: (d: number) => ({ opacity: 0, x: d * -40 })
							}}
							initial="initial"
							animate="animate"
							exit="exit"
							transition={{ type: "spring", stiffness: 380, damping: 34 }}
						>
							{cells.map(({ date, inMonth }) => {
								const events = inMonth ? byDay.get(date.getDate()) : undefined;
								const isToday = sameDay(date, today);
								const isSel = sameDay(date, selected);
								const important = events?.some((e) => isImportantEvent(e) || isDeadline(e.title));
								return (
									<button
										type="button"
										key={date.toISOString()}
										className={`tc-day${inMonth ? "" : " out"}${isToday ? " today" : ""}${isSel ? " selected" : ""}`}
										aria-label={date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
										aria-pressed={isSel}
										onClick={() => pick(date)}
									>
										{isSel && (
											<motion.span
												layoutId="tc-selected"
												className="tc-day-ring"
												transition={{ type: "spring", stiffness: 500, damping: 36 }}
											/>
										)}
										<span className="tc-day-num">{date.getDate()}</span>
										<span className={`tc-dot${events?.length ? " on" : ""}${important ? " important" : ""}`} />
									</button>
								);
							})}
						</motion.div>
					</AnimatePresence>
				</div>

				<div className="ta">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={selected.toDateString()}
							className="ta-list"
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -4 }}
							transition={{ duration: 0.16 }}
						>
							{feedStatus === "off" ? (
								<div className="ta-empty">
									<span>Link your calendar to see classes here.</span>
									<button type="button" className="tp-chip" onClick={onOpenBloomSettings}>
										Bloom settings
									</button>
								</div>
							) : agenda.length === 0 ? (
								<div className="ta-empty">
									<span>{isSelectedToday ? "Nothing else today" : "Nothing on this day"}</span>
								</div>
							) : (
								<>
									{agenda.slice(0, agendaRows).map((ev) => (
										<AgendaRow key={ev.id} ev={ev} day={selected} now={now} />
									))}
									{agenda.length > agendaRows && (
										<span className="ta-more">+{agenda.length - agendaRows} more</span>
									)}
								</>
							)}
						</motion.div>
					</AnimatePresence>
				</div>

				<div className="tf">
					<AnimatePresence mode="popLayout" initial={false}>
						{focusActive ? (
							<motion.div
								key="running"
								className="tf-row"
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.18 }}
							>
								<Hourglass className="tf-icon" />
								<span className="tf-label">
									<b>{timer!.running ? "Focusing" : "Paused"}</b>
									<span>{countdownText(timer!.seconds)} left</span>
								</span>
								<button type="button" className="tp-chip" onClick={() => onFocus({ action: "stop" })}>
									Stop
								</button>
							</motion.div>
						) : (
							<motion.div
								key="idle"
								className="tf-row"
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.18 }}
							>
								<button
									type="button"
									className="tp-icon-btn"
									aria-label="Shorter"
									onClick={() => setFocusMinutes(stepFocus(focusMinutes, -1))}
								>
									−
								</button>
								<span className="tf-minutes">
									<AnimatePresence mode="popLayout" initial={false}>
										<motion.b
											key={focusMinutes}
											initial={{ opacity: 0, y: -6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: 6 }}
											transition={{ duration: 0.14 }}
										>
											{focusMinutes}
										</motion.b>
									</AnimatePresence>{" "}
									min
								</span>
								<button
									type="button"
									className="tp-icon-btn"
									aria-label="Longer"
									onClick={() => setFocusMinutes(stepFocus(focusMinutes, 1))}
								>
									+
								</button>
								<motion.button
									type="button"
									className="tf-start"
									whileTap={{ scale: 0.95 }}
									onClick={() => onFocus({ action: "start", seconds: focusMinutes * 60 })}
								>
									<Play />
									Start Focus
								</motion.button>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</section>
			</div>
		</div>
	);
}

/** Sends a Focus command to the notch, which owns the timer. */
export function sendFocus(cmd: FocusTimerCommand) {
	emit(FOCUS_TIMER_EVENT, cmd).catch(() => {});
}
