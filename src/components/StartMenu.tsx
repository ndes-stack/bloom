// Bloom's own Start menu, opened from the dock's Start button: search
// (apps, Settings pages, recent files and your classes), pinned apps, what's
// on now from your calendar, recent files, All apps, folders and power.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import {
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	FileText,
	Lock,
	LogOut,
	Moon,
	Pin,
	PinOff,
	Power,
	RotateCcw,
	Search,
	Settings,
	SlidersHorizontal
} from "lucide-react";
import { useCalendarDays } from "../hooks/useCalendarEvents";
import type { CalendarEvent } from "../calendarIcs";
import type { AppInfo } from "../dockApps";
import { relativeTime } from "../dockTray";
import {
	SETTINGS_PAGES,
	fileTone,
	matchScore,
	parseStartPins,
	type StartPin
} from "../startMenu";
import "./StartMenu.css";

interface RecentFile {
	name: string;
	path: string;
	ext: string;
	folder: string;
	opened: number;
}

type Result =
	| { kind: "app"; key: string; app: AppInfo; score: number }
	| { kind: "setting"; key: string; name: string; uri: string; score: number }
	| { kind: "file"; key: string; file: RecentFile; score: number }
	| { kind: "event"; key: string; event: CalendarEvent; score: number };

// The installed-apps scan is slow the first time, so keep it for the session.
let installedCache: AppInfo[] | null = null;

function AppIcon({ app, icon, size }: { app: { name: string }; icon?: string; size: number }) {
	return icon ? (
		<img className="sm-icon" src={icon} alt="" draggable={false} style={{ width: size, height: size }} />
	) : (
		<span className="sm-icon sm-icon-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>
			{app.name[0]}
		</span>
	);
}

function FileIcon({ ext }: { ext: string }) {
	return (
		<span className="sm-file-icon" style={{ background: fileTone(ext) }}>
			<FileText />
			<b>{ext.slice(0, 4).toUpperCase()}</b>
		</span>
	);
}

const clock = (d: Date, use24h: boolean) =>
	d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !use24h });

/** The class on now, or the next one today. */
function useUpNext(use24h: boolean) {
	const { days } = useCalendarDays(new Date(), 1);
	const now = new Date();
	const today = (days[0] ?? []).filter((e) => !e.allDay && e.end > now);
	const current = today.find((e) => e.start <= now);
	const next = today.find((e) => e.start > now);
	if (!current && !next) return null;
	const main = current ?? next!;
	return {
		title: main.title + (main.location ? ` · ${main.location}` : ""),
		when: current ? `Now · until ${clock(current.end, use24h)}` : `Today at ${clock(main.start, use24h)}`,
		after: current && next ? `Next: ${next.title} at ${clock(next.start, use24h)}` : null
	};
}

export function StartMenu({
	icons,
	requestIcon,
	dockPins,
	pinsSetting,
	savePins,
	use24h,
	onClose,
	onOpenCalendar
}: {
	icons: Record<string, string>;
	requestIcon: (path: string, name?: string) => void;
	/** The dock's pinned apps, the default Start pins. */
	dockPins: AppInfo[];
	pinsSetting: string | null;
	savePins: (pins: StartPin[]) => void;
	use24h: boolean;
	onClose: () => void;
	/** A class in the results opens the dock's calendar panel. */
	onOpenCalendar: () => void;
}) {
	const [query, setQuery] = useState("");
	const [view, setView] = useState<"home" | "all">("home");
	const [apps, setApps] = useState<AppInfo[]>(installedCache ?? []);
	const [recent, setRecent] = useState<RecentFile[]>([]);
	const [user, setUser] = useState("");
	const [selected, setSelected] = useState(0);
	const [powerOpen, setPowerOpen] = useState(false);
	const [menu, setMenu] = useState<{ x: number; y: number; pin: StartPin; pinned: boolean } | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const upNext = useUpNext(use24h);

	const pins = useMemo<StartPin[]>(
		() =>
			parseStartPins(pinsSetting) ??
			dockPins.slice(0, 12).map((a) => ({ name: a.name, path: a.path })),
		[pinsSetting, dockPins]
	);

	// Start takes keyboard focus for its search box, and hands it back to
	// the app you were in when it closes without opening anything.
	useEffect(() => {
		let previous = 0;
		invoke<number>("focus_dock_window")
			.then((p) => {
				previous = p ?? 0;
				inputRef.current?.focus();
			})
			.catch(() => inputRef.current?.focus());
		return () => {
			invoke("restore_foreground", { previous }).catch(() => {});
		};
	}, []);

	useEffect(() => {
		if (!installedCache) {
			invoke<AppInfo[]>("get_installed_apps")
				.then((list) => {
					installedCache = [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name));
					setApps(installedCache);
				})
				.catch(() => {});
		}
		invoke<RecentFile[]>("get_recent_files", { limit: 8 })
			.then((r) => setRecent(r ?? []))
			.catch(() => {});
		invoke<string>("get_user_display_name")
			.then((n) => setUser(n ?? ""))
			.catch(() => {});
	}, []);

	useEffect(() => {
		pins.forEach((p) => requestIcon(p.path, p.name));
	}, [pins, requestIcon]);

	// Upcoming classes for search: the next two weeks.
	const { days: weeks } = useCalendarDays(new Date(), 14);

	const results = useMemo<Result[]>(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		const out: Result[] = [];
		for (const app of apps) {
			const score = matchScore(app.name, q);
			if (score > 0) out.push({ kind: "app", key: `a:${app.path}`, app, score: score + 2 });
		}
		for (const s of SETTINGS_PAGES) {
			const score = Math.max(matchScore(s.name, q), ...s.keywords.map((k) => matchScore(k, q) - 1));
			if (score > 0) out.push({ kind: "setting", key: `s:${s.uri}`, name: s.name, uri: s.uri, score });
		}
		for (const f of recent) {
			const score = matchScore(f.name, q);
			if (score > 0) out.push({ kind: "file", key: `f:${f.path}`, file: f, score: score + 1 });
		}
		const seen = new Set<string>();
		for (const ev of weeks.flat()) {
			if (seen.has(ev.title) || ev.end < new Date()) continue;
			const score = matchScore(ev.title, q);
			if (score > 0) {
				seen.add(ev.title);
				out.push({ kind: "event", key: `e:${ev.id}`, event: ev, score });
			}
		}
		return out.sort((a, b) => b.score - a.score).slice(0, 7);
	}, [query, apps, recent, weeks]);

	useEffect(() => setSelected(0), [query]);
	useEffect(() => {
		results.forEach((r) => r.kind === "app" && requestIcon(r.app.path, r.app.name));
	}, [results, requestIcon]);

	const launchApp = (app: { name: string; path: string }) => {
		invoke("open_app", { appName: app.path }).catch(() => {});
		onClose();
	};
	const openFile = (f: RecentFile) => {
		invoke("shelf_open", { path: f.path }).catch(() => {});
		onClose();
	};
	const openResult = (r: Result) => {
		if (r.kind === "app") launchApp(r.app);
		else if (r.kind === "setting") {
			invoke("open_settings_page", { uri: r.uri }).catch(() => {});
			onClose();
		} else if (r.kind === "file") openFile(r.file);
		else onOpenCalendar();
	};

	const isPinned = (path: string) => pins.some((p) => p.path === path);
	const togglePin = (pin: StartPin) => {
		savePins(isPinned(pin.path) ? pins.filter((p) => p.path !== pin.path) : [...pins, pin].slice(0, 18));
		setMenu(null);
	};
	const openMenu = (e: React.MouseEvent, pin: StartPin) => {
		e.preventDefault();
		e.stopPropagation();
		const box = (e.currentTarget.closest(".sm") as HTMLElement).getBoundingClientRect();
		setMenu({ x: e.clientX - box.left, y: e.clientY - box.top, pin, pinned: isPinned(pin.path) });
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			if (menu) setMenu(null);
			else if (powerOpen) setPowerOpen(false);
			else if (query) setQuery("");
			else if (view === "all") setView("home");
			else onClose();
			e.stopPropagation();
			return;
		}
		if (!results.length) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelected((i) => Math.min(i + 1, results.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelected((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const r = results[selected];
			if (r) openResult(r);
		}
	};

	// All apps, grouped by first letter.
	const groups = useMemo(() => {
		const map = new Map<string, AppInfo[]>();
		for (const a of apps) {
			const ch = a.name[0]?.toUpperCase() ?? "#";
			const key = /[A-Z]/.test(ch) ? ch : "#";
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(a);
		}
		return [...map.entries()];
	}, [apps]);
	useEffect(() => {
		if (view === "all") apps.slice(0, 40).forEach((a) => requestIcon(a.path, a.name));
	}, [view, apps, requestIcon]);
	const jumpTo = (letter: string) => {
		const el = listRef.current?.querySelector(`[data-letter="${letter}"]`) as HTMLElement | null;
		if (el && listRef.current) listRef.current.scrollTo({ top: el.offsetTop - 4, behavior: "smooth" });
	};

	const searching = query.trim().length > 0;
	const firstName = user.split(" ")[0] || user;

	return (
		<div className="sm" onKeyDown={onKeyDown} onClick={() => (setMenu(null), setPowerOpen(false))}>
			<div className="sm-search">
				<Search />
				<input
					ref={inputRef}
					value={query}
					placeholder="Search apps, files and settings"
					onChange={(e) => setQuery(e.target.value)}
					spellCheck={false}
					aria-label="Search"
				/>
			</div>

			<div className="sm-body">
				<AnimatePresence mode="popLayout" initial={false}>
					{searching ? (
						<motion.div
							key="results"
							className="sm-results"
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							transition={{ duration: 0.16 }}
						>
							{results.length === 0 && <div className="sm-empty">Nothing matches "{query.trim()}"</div>}
							{results.map((r, i) => (
								<button
									type="button"
									key={r.key}
									className={`sm-result${i === selected ? " selected" : ""}`}
									onMouseEnter={() => setSelected(i)}
									onClick={() => openResult(r)}
									onContextMenu={(e) =>
										r.kind === "app" && openMenu(e, { name: r.app.name, path: r.app.path })
									}
								>
									{r.kind === "app" ? (
										<AppIcon app={r.app} icon={icons[r.app.path]} size={30} />
									) : r.kind === "setting" ? (
										<span className="sm-glyph">
											<SlidersHorizontal />
										</span>
									) : r.kind === "file" ? (
										<FileIcon ext={r.file.ext} />
									) : (
										<span className="sm-glyph accent">
											<CalendarDays />
										</span>
									)}
									<span className="sm-result-text">
										<b>
											{r.kind === "app"
												? r.app.name
												: r.kind === "setting"
													? r.name
													: r.kind === "file"
														? r.file.name
														: r.event.title}
										</b>
										<span>
											{r.kind === "app"
												? "App"
												: r.kind === "setting"
													? "Settings"
													: r.kind === "file"
														? `File · ${r.file.folder}`
														: `Class · ${r.event.start.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${clock(r.event.start, use24h)}`}
										</span>
									</span>
									{i === selected && <span className="sm-enter">Enter</span>}
								</button>
							))}
						</motion.div>
					) : view === "all" ? (
						<motion.div
							key="all"
							className="sm-all"
							initial={{ opacity: 0, x: 28 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: 28 }}
							transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
						>
							<div className="sm-head">
								<button type="button" className="sm-icon-btn" aria-label="Back" onClick={() => setView("home")}>
									<ChevronLeft />
								</button>
								<b>All apps</b>
								<span className="sm-count">{apps.length} apps</span>
							</div>
							<div className="sm-all-wrap">
								<div className="sm-all-list" ref={listRef}>
									{groups.map(([letter, list]) => (
										<div key={letter} data-letter={letter}>
											<span className="sm-letter">{letter}</span>
											{list.map((a) => (
												<button
													type="button"
													key={a.path}
													className="sm-row"
													onClick={() => launchApp(a)}
													onContextMenu={(e) => openMenu(e, { name: a.name, path: a.path })}
													onMouseEnter={() => requestIcon(a.path, a.name)}
												>
													<AppIcon app={a} icon={icons[a.path]} size={26} />
													<span>{a.name}</span>
												</button>
											))}
										</div>
									))}
									{apps.length === 0 && <div className="sm-empty">Finding your apps…</div>}
								</div>
								<div className="sm-rail">
									{"#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch) => {
										const has = groups.some(([l]) => l === ch);
										return (
											<button
												type="button"
												key={ch}
												disabled={!has}
												className={has ? "on" : ""}
												onClick={() => jumpTo(ch)}
											>
												{ch}
											</button>
										);
									})}
								</div>
							</div>
						</motion.div>
					) : (
						<motion.div
							key="home"
							className="sm-home"
							initial={{ opacity: 0, x: -28 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -28 }}
							transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
						>
							<div className="sm-head">
								<b>Pinned</b>
								<button type="button" className="sm-chip" onClick={() => setView("all")}>
									All apps <ChevronRight />
								</button>
							</div>
							<div className="sm-grid">
								{pins.slice(0, 12).map((p, i) => (
									<motion.button
										type="button"
										key={p.path}
										className="sm-tile"
										initial={{ opacity: 0, y: 6, scale: 0.94 }}
										animate={{ opacity: 1, y: 0, scale: 1 }}
										transition={{ duration: 0.22, delay: 0.015 * i, ease: [0.32, 0.72, 0, 1] }}
										whileTap={{ scale: 0.93 }}
										onClick={() => launchApp(p)}
										onContextMenu={(e) => openMenu(e, p)}
									>
										<AppIcon app={p} icon={icons[p.path]} size={38} />
										<span>{p.name}</span>
									</motion.button>
								))}
								{pins.length === 0 && (
									<div className="sm-empty wide">Right-click an app in All apps to pin it here</div>
								)}
							</div>

							{upNext && (
								<div className="sm-upnext">
									<span className="sm-upnext-bar" />
									<span className="sm-upnext-text">
										<b>{upNext.title}</b>
										<span>{upNext.when}</span>
									</span>
									{upNext.after && <span className="sm-upnext-after">{upNext.after}</span>}
								</div>
							)}

							{recent.length > 0 && (
								<>
									<div className="sm-head">
										<b>Recent</b>
									</div>
									<div className="sm-recent">
										{recent.slice(0, upNext ? 2 : 4).map((f) => (
											<button type="button" key={f.path} className="sm-file" onClick={() => openFile(f)}>
												<FileIcon ext={f.ext} />
												<span className="sm-result-text">
													<b>{f.name}</b>
													<span>
														{f.folder} · {relativeTime(f.opened, Date.now())}
													</span>
												</span>
											</button>
										))}
									</div>
								</>
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			<div className="sm-footer">
				<span className="sm-avatar">{(firstName[0] ?? "?").toUpperCase()}</span>
				<b className="sm-user">{user}</b>
				<button type="button" className="sm-chip" onClick={() => (invoke("open_known_folder", { name: "downloads" }).catch(() => {}), onClose())}>
					Downloads
				</button>
				<button type="button" className="sm-chip" onClick={() => (invoke("open_known_folder", { name: "documents" }).catch(() => {}), onClose())}>
					Documents
				</button>
				<button
					type="button"
					className="sm-icon-btn"
					aria-label="Settings"
					onClick={() => (invoke("open_system_action", { action: "settings" }).catch(() => {}), onClose())}
				>
					<Settings />
				</button>
				<div className="sm-power-wrap">
					<button
						type="button"
						className={`sm-icon-btn${powerOpen ? " open" : ""}`}
						aria-label="Power"
						aria-expanded={powerOpen}
						onClick={(e) => {
							e.stopPropagation();
							setPowerOpen((v) => !v);
						}}
					>
						<Power />
					</button>
					<AnimatePresence>
						{powerOpen && (
							<motion.div
								className="sm-power"
								initial={{ opacity: 0, y: 6, scale: 0.96 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								exit={{ opacity: 0, y: 4, scale: 0.98 }}
								transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
								onClick={(e) => e.stopPropagation()}
							>
								{[
									{ id: "lock", label: "Lock", icon: <Lock /> },
									{ id: "sleep", label: "Sleep", icon: <Moon /> },
									{ id: "signout", label: "Sign out", icon: <LogOut /> },
									{ id: "restart", label: "Restart", icon: <RotateCcw /> },
									{ id: "shutdown", label: "Shut down", icon: <Power /> }
								].map((a) => (
									<button
										type="button"
										key={a.id}
										onClick={() => {
											onClose();
											invoke("power_action", { action: a.id }).catch(() => {});
										}}
									>
										{a.icon}
										{a.label}
									</button>
								))}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>

			<AnimatePresence>
				{menu && (
					<motion.div
						className="sm-menu"
						style={{ left: menu.x, top: menu.y }}
						initial={{ opacity: 0, scale: 0.96 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.98 }}
						transition={{ duration: 0.12 }}
						onClick={(e) => e.stopPropagation()}
					>
						<button type="button" onClick={() => launchApp(menu.pin)}>
							Open
						</button>
						<button type="button" onClick={() => togglePin(menu.pin)}>
							{menu.pinned ? <PinOff /> : <Pin />}
							{menu.pinned ? "Unpin from Start" : "Pin to Start"}
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
