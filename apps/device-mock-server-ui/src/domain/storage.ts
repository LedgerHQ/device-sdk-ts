/**
 * Session tokens the browser remembers, so a reload (or a second visit) does
 * not mean re-pasting a token. Tokens only ever exist in the server's memory,
 * so a remembered one goes stale on restart — the landing page checks each one.
 */

const ACTIVE_KEY = "mock-server-ui.active-token";
const KNOWN_KEY = "mock-server-ui.known-tokens";

export interface KnownSession {
  readonly token: string;
  /** Epoch ms of the last time this UI used the token. */
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
    // Storage unavailable — the UI still works, it just forgets.
  }
};

export const getActiveToken = (): string | null => read(ACTIVE_KEY, null);

export const setActiveToken = (token: string | null): void =>
  write(ACTIVE_KEY, token);

export const getKnownSessions = (): KnownSession[] =>
  read<KnownSession[]>(KNOWN_KEY, []);

/** Record a token as used now, keeping the most recent five. */
export const rememberSession = (token: string): void => {
  const others = getKnownSessions().filter((entry) => entry.token !== token);
  write(KNOWN_KEY, [{ token, lastUsedAt: Date.now() }, ...others].slice(0, 5));
};

export const forgetSession = (token: string): void =>
  write(
    KNOWN_KEY,
    getKnownSessions().filter((entry) => entry.token !== token),
  );
