const ACTIVE_KEY = "mock-server-ui.active-token";
const KNOWN_KEY = "mock-server-ui.known-tokens";

export interface KnownSession {
  readonly token: string;
  readonly lastUsedAt: number;
}

/** localStorage throws in private-mode browsers; a missing store is not fatal. */
const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // No storage: the UI works, it just forgets.
  }
};

export const getActiveToken = (): string | null => read(ACTIVE_KEY, null);

export const setActiveToken = (token: string | null): void =>
  write(ACTIVE_KEY, token);

export const getKnownSessions = (): KnownSession[] =>
  read<KnownSession[]>(KNOWN_KEY, []);

export const rememberSession = (token: string): void => {
  const others = getKnownSessions().filter((entry) => entry.token !== token);
  write(KNOWN_KEY, [{ token, lastUsedAt: Date.now() }, ...others].slice(0, 5));
};

export const forgetSession = (token: string): void =>
  write(
    KNOWN_KEY,
    getKnownSessions().filter((entry) => entry.token !== token),
  );

const SNAPSHOTS_KEY = "mock-server-ui.saved-snapshots";

export interface SavedSnapshot {
  readonly name: string;
  readonly savedAt: number;
  /** Same JSON text as an exported file, so both import the same way. */
  readonly snapshot: string;
  /** Typed at save time: the server cannot read the session seed back. */
  readonly seed?: string;
}

export const getSavedSnapshots = (): SavedSnapshot[] =>
  read<SavedSnapshot[]>(SNAPSHOTS_KEY, []);

/** Saving under an existing name replaces it. */
export const saveSnapshot = (
  name: string,
  snapshot: string,
  seed?: string,
): void => {
  const others = getSavedSnapshots().filter((entry) => entry.name !== name);
  write(SNAPSHOTS_KEY, [
    { name, savedAt: Date.now(), snapshot, seed },
    ...others,
  ]);
};

export const deleteSavedSnapshot = (name: string): void =>
  write(
    SNAPSHOTS_KEY,
    getSavedSnapshots().filter((entry) => entry.name !== name),
  );
