import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	DndContext,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, Folder, Globe, Minus, Pin, Plus, Search, X } from "lucide-react";

// ── Sizes (the notch sizes itself from these) ──────────────────────────

export const LAUNCHER_WIDTH = 520;
const COLUMNS = 6;
const MAX_VISIBLE_ROWS = 3;
const ROW_H = 74;
const ROW_GAP = 8;
const RESULT_H = 40;
const MAX_RESULTS = 6;
const CHROME = 36 + 12 + 34 + 10 + 14; // notch bar, top padding, search, gap, bottom padding
const EDIT_ACTIONS_H = 28 + 12;
const URL_FORM_H = 34 + 8;
export const LAUNCHER_DEFAULT_HEIGHT = CHROME + ROW_H;

// ── Pinned items ───────────────────────────────────────────────────────

const ITEMS_KEY = "bloom-launcher-items";

type LaunchKind = "app" | "folder" | "file" | "url";

interface LaunchItem {
	id: string;
	kind: LaunchKind;
	name: string;
	/** App path / shortcut / shell id, folder or file path, or https URL. */
	target: string;
}

interface InstalledApp {
	name: string;
	path: string;
}

function parseItems(raw: unknown): LaunchItem[] | null {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!Array.isArray(data)) return null;
		return data.filter(
			(it): it is LaunchItem =>
				it &&
				typeof it.id === "string" &&
				typeof it.name === "string" &&
				typeof it.target === "string" &&
				["app", "folder", "file", "url"].includes(it.kind)
		);
	} catch {
		return null;
	}
}

function readStoredItems(): LaunchItem[] {
	try {
		return parseItems(localStorage.getItem(ITEMS_KEY)) ?? [];
	} catch {
		return [];
	}
}

function persistItems(items: LaunchItem[]) {
	const value = JSON.stringify(items);
	try {
		localStorage.setItem(ITEMS_KEY, value);
	} catch {
		// The settings file below still keeps them.
	}
	invoke("save_setting", { key: ITEMS_KEY, value }).catch(console.error);
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function baseName(path: string): string {
	const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
	return parts[parts.length - 1] || path;
}

/** "github.com", "uni.ac.za/portal" → https URL, or null if it doesn't look like a web address. */
function asWebAddress(text: string): string | null {
	const t = text.trim();
	if (!t || /\s/.test(t)) return null;
	if (/^https?:\/\//i.test(t)) return t;
	if (/^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(t)) return `https://${t}`;
	return null;
}

/** "github.com/ndes-stack" style label for a URL. */
function siteName(url: string): string {
	try {
		const u = new URL(url);
		const path = u.pathname.replace(/\/+$/, "");
		return u.hostname.replace(/^www\./, "") + path;
	} catch {
		return url;
	}
}

// ── Shared caches (the launcher remounts every time the page opens) ────

const iconCache = new Map<string, string | null>();
let installedAppsPromise: Promise<InstalledApp[]> | null = null;

function loadInstalledApps(): Promise<InstalledApp[]> {
	if (!installedAppsPromise) {
		installedAppsPromise = invoke<InstalledApp[]>("get_installed_apps")
			.then((apps) => apps.map(({ name, path }) => ({ name, path })))
			.catch(() => {
				installedAppsPromise = null;
				return [];
			});
	}
	return installedAppsPromise;
}

function useIcon(kind: LaunchKind, target: string, name: string): string | null {
	const wantsIcon = kind === "app" || kind === "file";
	const [icon, setIcon] = useState<string | null>(() => iconCache.get(target) ?? null);
	useEffect(() => {
		if (!wantsIcon) return;
		if (iconCache.has(target)) {
			setIcon(iconCache.get(target) ?? null);
			return;
		}
		let active = true;
		invoke<string | null>("get_app_icon", { path: target, name, hwnd: null })
			.then((res) => {
				iconCache.set(target, res ?? null);
				if (active) setIcon(res ?? null);
			})
			.catch(() => iconCache.set(target, null));
		return () => {
			active = false;
		};
	}, [wantsIcon, target, name]);
	return icon;
}

function launch(kind: LaunchKind, target: string) {
	if (kind === "app") invoke("open_app", { appName: target }).catch(console.error);
	else invoke("open_dock_extra", { kind, path: target }).catch(console.error);
}

// ── Icons ──────────────────────────────────────────────────────────────

function ItemIcon({ kind, target, name, size }: { kind: LaunchKind; target: string; name: string; size: number }) {
	const icon = useIcon(kind, target, name);
	if (icon) return <img className="launcher-icon-img" src={icon} alt="" style={{ width: size, height: size }} />;
	const glyph = Math.round(size * 0.48);
	return (
		<span className={`launcher-icon-fallback kind-${kind}`} style={{ width: size, height: size }} aria-hidden="true">
			{kind === "folder" ? (
				<Folder size={glyph} strokeWidth={2} />
			) : kind === "url" ? (
				<Globe size={glyph} strokeWidth={2} />
			) : kind === "file" ? (
				<FileText size={glyph} strokeWidth={2} />
			) : (
				<span className="launcher-icon-letter" style={{ fontSize: glyph }}>
					{name.charAt(0).toUpperCase()}
				</span>
			)}
		</span>
	);
}

// ── Grid tile ──────────────────────────────────────────────────────────

function Tile({ item, editing, onRemove }: { item: LaunchItem; editing: boolean; onRemove: () => void }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.id,
		disabled: !editing
	});
	return (
		<div
			ref={setNodeRef}
			className={`launcher-tile ${editing ? "editing" : ""} ${isDragging ? "dragging" : ""}`}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<button
				className="launcher-tile-btn"
				title={editing ? `Drag to move ${item.name}` : item.name}
				onClick={() => !editing && launch(item.kind, item.target)}
				{...(editing ? attributes : {})}
				{...(editing ? listeners : {})}
			>
				<ItemIcon kind={item.kind} target={item.target} name={item.name} size={46} />
				<span className="launcher-tile-label">{item.name}</span>
			</button>
			{editing && (
				<button className="launcher-remove" aria-label={`Remove ${item.name}`} onClick={onRemove}>
					<Minus size={10} strokeWidth={4} />
				</button>
			)}
		</div>
	);
}

// ── Search results ─────────────────────────────────────────────────────

interface Result {
	key: string;
	kind: LaunchKind;
	name: string;
	target: string;
	detail: string;
	pinned: boolean;
}

// ── Component ──────────────────────────────────────────────────────────

interface QuickLauncherProps {
	/** Reports the notch height this page needs. */
	onHeightChange: (height: number) => void;
	/** Keeps the notch open while typing or while a file picker is open. */
	onPinChange: (pinned: boolean) => void;
	/** Bumped when the launcher should put the cursor in its search box. */
	focusToken?: number;
}

export function QuickLauncher({ onHeightChange, onPinChange, focusToken = 0 }: QuickLauncherProps) {
	const [items, setItems] = useState<LaunchItem[]>(readStoredItems);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState(0);
	const [editing, setEditing] = useState(false);
	const [urlFormOpen, setUrlFormOpen] = useState(false);
	const [urlDraft, setUrlDraft] = useState("");
	const [apps, setApps] = useState<InstalledApp[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);

	// settings.json is the source of truth (it also survives a reinstall).
	useEffect(() => {
		invoke<Record<string, unknown>>("load_settings")
			.then((settings) => {
				const stored = parseItems(settings[ITEMS_KEY]);
				if (stored) setItems(stored);
			})
			.catch(() => {});
	}, []);

	// Installed apps are only needed once you search.
	useEffect(() => {
		if (query.trim() && apps.length === 0) loadInstalledApps().then(setApps);
	}, [query, apps.length]);

	// Never leave the notch pinned open after this page closes.
	useEffect(() => () => onPinChange(false), [onPinChange]);
	useEffect(() => {
		if (focusToken) inputRef.current?.focus();
	}, [focusToken]);

	const update = (next: LaunchItem[]) => {
		setItems(next);
		persistItems(next);
	};
	const pin = (kind: LaunchKind, name: string, target: string) => {
		if (items.some((it) => it.target.toLowerCase() === target.toLowerCase())) return;
		update([...items, { id: newId(), kind, name, target }]);
	};

	const results = useMemo<Result[]>(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		const score = (name: string) => {
			const n = name.toLowerCase();
			if (n.startsWith(q)) return 0;
			if (n.split(/[\s\-_.]+/).some((w) => w.startsWith(q))) return 1;
			return n.includes(q) ? 2 : -1;
		};
		const pinnedTargets = new Set(items.map((it) => it.target.toLowerCase()));
		const out: Result[] = [];
		const web = asWebAddress(query);
		if (web) {
			out.push({
				key: `url:${web}`,
				kind: "url",
				name: siteName(web),
				target: web,
				detail: "Open website",
				pinned: pinnedTargets.has(web.toLowerCase())
			});
		}
		items
			.map((it) => ({ it, s: score(it.name) }))
			.filter(({ s }) => s >= 0)
			.sort((a, b) => a.s - b.s)
			.forEach(({ it }) =>
				out.push({ key: it.id, kind: it.kind, name: it.name, target: it.target, detail: "Pinned", pinned: true })
			);
		const seen = new Set<string>();
		apps
			.map((app) => ({ app, s: score(app.name) }))
			.filter(({ app, s }) => s >= 0 && !pinnedTargets.has(app.path.toLowerCase()))
			.sort((a, b) => a.s - b.s || a.app.name.localeCompare(b.app.name))
			.forEach(({ app }) => {
				const k = app.name.toLowerCase();
				if (seen.has(k)) return;
				seen.add(k);
				out.push({ key: `app:${app.path}`, kind: "app", name: app.name, target: app.path, detail: "App", pinned: false });
			});
		return out.slice(0, MAX_RESULTS);
	}, [query, items, apps]);

	useEffect(() => setSelected(0), [query]);

	// Height this page needs, reported to the notch.
	const searching = query.trim().length > 0;
	const tileCount = items.length + (editing ? 0 : 1);
	const rows = Math.min(MAX_VISIBLE_ROWS, Math.max(1, Math.ceil(tileCount / COLUMNS)));
	const bodyH = searching
		? Math.max(1, results.length) * RESULT_H
		: rows * ROW_H + (rows - 1) * ROW_GAP + (editing ? EDIT_ACTIONS_H + (urlFormOpen ? URL_FORM_H : 0) : 0);
	const height = CHROME + bodyH;
	useEffect(() => onHeightChange(height), [height, onHeightChange]);

	const openResult = (r: Result | undefined) => {
		if (!r) return;
		launch(r.kind, r.target);
		setQuery("");
		inputRef.current?.blur();
	};

	const pickPath = async (directory: boolean) => {
		onPinChange(true);
		try {
			const { open } = await import("@tauri-apps/plugin-dialog");
			const picked = await open({
				title: directory ? "Pin a folder to the launcher" : "Pin a file to the launcher",
				directory,
				multiple: false
			});
			if (typeof picked === "string") pin(directory ? "folder" : "file", baseName(picked), picked);
		} catch (e) {
			console.error("Picker failed:", e);
		} finally {
			onPinChange(false);
		}
	};

	const addWebsite = () => {
		const web = asWebAddress(urlDraft);
		if (!web) return;
		pin("url", siteName(web), web);
		setUrlDraft("");
		setUrlFormOpen(false);
	};

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = items.findIndex((it) => it.id === active.id);
		const to = items.findIndex((it) => it.id === over.id);
		if (from >= 0 && to >= 0) update(arrayMove(items, from, to));
	};

	return (
		<div className="launcher">
			<div className="launcher-top">
				<label className="launcher-search">
					<Search size={14} strokeWidth={2.5} aria-hidden="true" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						spellCheck={false}
						autoComplete="off"
						aria-label="Search apps, or type a website"
						placeholder={editing ? "Search for an app to pin…" : "Search apps or type a website…"}
						onChange={(e) => setQuery(e.target.value)}
						onFocus={() => onPinChange(true)}
						onBlur={() => onPinChange(false)}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setSelected((i) => Math.min(i + 1, results.length - 1));
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setSelected((i) => Math.max(i - 1, 0));
							} else if (e.key === "Enter") {
								e.preventDefault();
								openResult(results[selected]);
							} else if (e.key === "Escape") {
								setQuery("");
								e.currentTarget.blur();
							}
						}}
					/>
					{query && (
						<button className="launcher-clear" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery("")}>
							<X size={11} strokeWidth={2.6} />
						</button>
					)}
				</label>
				<button
					className={`launcher-edit-btn ${editing ? "done" : ""}`}
					onClick={() => {
						setEditing((v) => !v);
						setUrlFormOpen(false);
					}}
				>
					{editing ? "Done" : "Edit"}
				</button>
			</div>

			{searching ? (
				<div className="launcher-results launcher-scroll" role="listbox" aria-label="Search results">
					{results.length === 0 && <div className="launcher-empty">No apps match “{query.trim()}”</div>}
					{results.map((r, i) => (
						<div
							key={r.key}
							role="option"
							aria-selected={i === selected}
							className={`launcher-result ${i === selected ? "selected" : ""}`}
							onMouseEnter={() => setSelected(i)}
						>
							<button className="launcher-result-open" onClick={() => openResult(r)}>
								<ItemIcon kind={r.kind} target={r.target} name={r.name} size={24} />
								<span className="launcher-result-name">{r.name}</span>
								<span className="launcher-result-detail">{r.detail}</span>
							</button>
							{!r.pinned && (
								<button
									className="launcher-pin-btn"
									title={`Pin ${r.name}`}
									onClick={() => pin(r.kind, r.name, r.target)}
								>
									<Pin size={11} strokeWidth={2.4} />
									Pin
								</button>
							)}
						</div>
					))}
				</div>
			) : (
				<>
					<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
						<SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
							<div
								className="launcher-grid launcher-scroll"
								style={{ maxHeight: MAX_VISIBLE_ROWS * ROW_H + (MAX_VISIBLE_ROWS - 1) * ROW_GAP }}
							>
								{items.map((it) => (
									<Tile
										key={it.id}
										item={it}
										editing={editing}
										onRemove={() => update(items.filter((x) => x.id !== it.id))}
									/>
								))}
								{!editing && (
									<div className="launcher-tile">
										<button
											className="launcher-tile-btn"
											title="Pin apps, folders or websites"
											onClick={() => {
												setEditing(true);
												inputRef.current?.focus();
											}}
										>
											<span className="launcher-add-icon">
												<Plus size={20} strokeWidth={2.2} />
											</span>
											<span className="launcher-tile-label">{items.length === 0 ? "Pin apps" : "Add"}</span>
										</button>
									</div>
								)}
							</div>
						</SortableContext>
					</DndContext>

					{editing && (
						<>
							<div className="launcher-actions">
								<span className="launcher-hint">Search above to pin apps · drag to reorder</span>
								<button onClick={() => pickPath(true)}>+ Folder…</button>
								<button onClick={() => pickPath(false)}>+ File…</button>
								<button onClick={() => setUrlFormOpen((v) => !v)}>+ Website…</button>
							</div>
							{urlFormOpen && (
								<form
									className="launcher-url-form"
									onSubmit={(e) => {
										e.preventDefault();
										addWebsite();
									}}
								>
									<input
										type="text"
										value={urlDraft}
										autoFocus
										spellCheck={false}
										aria-label="Website address"
										placeholder="e.g. github.com"
										onChange={(e) => setUrlDraft(e.target.value)}
										onFocus={() => onPinChange(true)}
										onBlur={() => onPinChange(false)}
									/>
									<button type="submit" disabled={!asWebAddress(urlDraft)}>
										Pin website
									</button>
								</form>
							)}
						</>
					)}
				</>
			)}
		</div>
	);
}
