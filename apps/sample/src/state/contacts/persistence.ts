import {
  type ContactsState,
  initialState,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from "./schema";

/**
 * Persisted shape mirrors the playground's `.contacts_wallet.json`.
 * If the schema version on disk doesn't match, we fall back to empty
 * — a future bump will get a one-shot migration here.
 */
export function loadPersistedContacts(): ContactsState {
  if (typeof window === "undefined") return initialState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialState;

    const parsed = JSON.parse(stored) as Partial<ContactsState>;
    if (parsed?.schemaVersion !== SCHEMA_VERSION) return initialState;

    return {
      schemaVersion: SCHEMA_VERSION,
      contacts: parsed.contacts ?? {},
      accounts: parsed.accounts ?? {},
    };
  } catch {
    return initialState;
  }
}

export function saveContacts(state: ContactsState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    console.warn("Failed to save contacts to localStorage");
  }
}

export function clearPersistedContacts(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.warn("Failed to clear contacts from localStorage");
  }
}
