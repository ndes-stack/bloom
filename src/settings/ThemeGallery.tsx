import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, X } from "lucide-react";
import { BUILT_IN_THEMES, parseThemes, SAVED_THEMES_KEY, THEME_KEYS, themeSwatch, type Theme } from "../themes";
import { useStored } from "./useStored";

function saveSetting(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// settings.json below still records it.
	}
	return invoke("save_setting", { key, value }).catch((e) => console.error(`Failed to save ${key}:`, e));
}

/**
 * Settings > Appearance > Themes: ready-made looks, and your own. Saving
 * keeps the current theme, colours, material, shadow, dock style and live
 * activity style under a name; a click on a card puts them all back.
 */
export function ThemeGallery() {
	const [savedRaw, setSavedRaw] = useStored(SAVED_THEMES_KEY, (v) => (typeof v === "string" ? v : "[]"));
	const saved = parseThemes(savedRaw);
	const [naming, setNaming] = useState(false);
	const [name, setName] = useState("");
	const [applied, setApplied] = useState<string | null>(null);

	const apply = async (theme: Theme) => {
		setApplied(theme.name);
		// One after another: the backend broadcasts each save in order.
		for (const [key, value] of Object.entries(theme.values)) await saveSetting(key, value);
	};

	const saveCurrent = async () => {
		const title = name.trim().slice(0, 24);
		if (!title) return;
		const settings = ((await invoke("load_settings").catch(() => ({}))) ?? {}) as Record<string, unknown>;
		const values = Object.fromEntries(
			Object.entries(THEME_KEYS).map(([key, fallback]) => {
				const value = settings[key] ?? localStorage.getItem(key);
				return [key, value === null || value === undefined ? fallback : String(value)];
			})
		);
		const next = [...saved.filter((t) => t.name !== title), { name: title, values }];
		setSavedRaw(JSON.stringify(next));
		setApplied(title);
		setName("");
		setNaming(false);
	};

	const remove = (title: string) => setSavedRaw(JSON.stringify(saved.filter((t) => t.name !== title)));

	const card = (theme: Theme) => {
		const swatch = themeSwatch(theme.values);
		return (
			<div key={`${theme.builtIn ? "b" : "s"}:${theme.name}`} className="theme-card-wrap">
				<button
					className={`theme-card${applied === theme.name ? " applied" : ""}`}
					onClick={() => apply(theme)}
					title={`Use ${theme.name}`}
				>
					<span className="theme-card-preview">
						<span className="theme-card-pill" style={{ background: swatch.surface, color: swatch.text }}>
							<span className="theme-card-dot" style={{ background: swatch.accent }} />
							<span className="theme-card-line" />
						</span>
					</span>
					<span className="theme-card-name">{theme.name}</span>
				</button>
				{!theme.builtIn && (
					<button className="theme-card-remove" aria-label={`Delete ${theme.name}`} onClick={() => remove(theme.name)}>
						<X size={11} />
					</button>
				)}
			</div>
		);
	};

	return (
		<div className="theme-gallery">
			<div className="theme-grid">
				{BUILT_IN_THEMES.map(card)}
				{saved.map(card)}
				{naming ? (
					<form
						className="theme-card theme-card-new naming"
						onSubmit={(e) => {
							e.preventDefault();
							saveCurrent();
						}}
					>
						<input
							autoFocus
							value={name}
							maxLength={24}
							placeholder="Theme name"
							onChange={(e) => setName(e.target.value)}
							onBlur={() => !name.trim() && setNaming(false)}
							onKeyDown={(e) => e.key === "Escape" && setNaming(false)}
						/>
						<button type="submit" disabled={!name.trim()}>
							Save
						</button>
					</form>
				) : (
					<button className="theme-card theme-card-new" onClick={() => setNaming(true)} disabled={saved.length >= 24}>
						<Plus size={16} />
						<span className="theme-card-name">Save current look</span>
					</button>
				)}
			</div>
		</div>
	);
}
