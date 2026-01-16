import { initialState, type SettingsState } from "./schema";

const STORAGE_KEY = "dmk-sample-settings";

export function loadPersistedSettings(): SettingsState {
  if (typeof window === "undefined") return initialState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialState;

    const parsed = JSON.parse(stored) as Partial<SettingsState>;
    return { ...initialState, ...parsed };
  } catch {
    return initialState;
  }
}

export function saveSettings(settings: SettingsState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    console.warn("Failed to save settings to localStorage");
  }
}
