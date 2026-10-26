// The notch Quick Launcher's shortcut, as written to settings and read by the
// keyboard hook (services.rs `parse_hotkey`): modifiers then one key, joined
// by "+", e.g. "Ctrl+Alt+Space". Key names are `KeyboardEvent.code` without
// its "Key"/"Digit" prefix.

export const LAUNCHER_SHORTCUT_KEY = "bloom-launcher-shortcut";
export const LAUNCHER_HOTKEY_KEY = "bloom-launcher-hotkey";
export const DEFAULT_LAUNCHER_HOTKEY = "Alt+Space";

const MODIFIER_CODES = new Set([
	"ControlLeft",
	"ControlRight",
	"AltLeft",
	"AltRight",
	"ShiftLeft",
	"ShiftRight",
	"MetaLeft",
	"MetaRight",
	"OSLeft",
	"OSRight"
]);

const NAMED_KEYS = new Set([
	"Space", "Enter", "Tab", "Backspace", "Insert", "Delete", "Home", "End", "PageUp", "PageDown",
	"ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Backquote", "Minus", "Equal",
	"BracketLeft", "BracketRight", "Backslash", "Semicolon", "Quote", "Comma", "Period", "Slash"
]);

const isFunctionKey = (k: string) => /^F([1-9]|1[0-9]|2[0-4])$/.test(k);

/** The key's name, or null for keys the hook can't match. */
export function keyName(code: string): string | null {
	const letterOrDigit = /^(?:Key|Digit)([A-Z0-9])$/.exec(code);
	if (letterOrDigit) return letterOrDigit[1];
	return isFunctionKey(code) || NAMED_KEYS.has(code) ? code : null;
}

const isKeyName = (k: string) => /^[A-Z0-9]$/.test(k) || isFunctionKey(k) || NAMED_KEYS.has(k);

/** A valid shortcut string, or the default for anything else. */
export function parseLauncherHotkey(v: unknown): string {
	if (typeof v !== "string") return DEFAULT_LAUNCHER_HOTKEY;
	const parts = v.split("+").map((p) => p.trim()).filter(Boolean);
	const mods = parts.filter((p) => ["Ctrl", "Alt", "Shift", "Win"].includes(p));
	const keys = parts.filter((p) => !mods.includes(p));
	if (keys.length !== 1 || !isKeyName(keys[0])) return DEFAULT_LAUNCHER_HOTKEY;
	if (mods.length === 0 && !isFunctionKey(keys[0])) return DEFAULT_LAUNCHER_HOTKEY;
	return parts.join("+");
}

/**
 * The shortcut a keydown spells, "modifier" while only modifiers are held,
 * or null when it can't be used (no modifier, or a key the hook can't match).
 */
export function hotkeyFromEvent(e: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): string | "modifier" | null {
	if (MODIFIER_CODES.has(e.code)) return "modifier";
	const key = keyName(e.code);
	if (!key) return null;
	const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Win"].filter(
		Boolean
	) as string[];
	if (mods.length === 0 && !isFunctionKey(key)) return null;
	return [...mods, key].join("+");
}
