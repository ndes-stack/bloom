import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsSync } from "../hooks/useSettingsSync";

/** One setting kept in localStorage + settings.json, following outside changes. */
export function useStored<T>(key: string, parse: (v: unknown) => T): [T, (v: T) => void] {
	const [value, setValue] = useState<T>(() => parse(localStorage.getItem(key)));
	useSettingsSync({ [key]: (v: unknown) => setValue(parse(v)) }, []);
	const save = (v: T) => {
		setValue(v);
		const str = String(v);
		try {
			localStorage.setItem(key, str);
		} catch {
			// settings.json below still records it.
		}
		invoke("save_setting", { key, value: str }).catch((e) => console.error(`Failed to save ${key}:`, e));
	};
	return [value, save];
}
