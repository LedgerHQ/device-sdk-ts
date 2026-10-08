import { initialState, type SettingsState } from "./schema";

const STORAGE_KEY = "dmk-sample-settings";

// Old default reporter URL: the reporters append their own version path,
// so this produced `/ingest/v1/v1/...` and `/ingest/v1/v2/...`.
const LEGACY_REPORTER_URL = "https://blind-signing.api.ledger.com/ingest/v1";

export function loadPersistedSettings(): SettingsState {
  if (typeof window === "undefined") return initialState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialState;

    const parsed = JSON.parse(stored) as Partial<SettingsState>;
    if (parsed.reporterConfig?.url === LEGACY_REPORTER_URL) {
      parsed.reporterConfig = initialState.reporterConfig;
    }
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
