/**
 * Minimal console logger for the mock server.
 *
 * Kept intentionally simple: it prefixes a timestamp, the originating session
 * tag (when logging within a request) and the level. Output is gated by a
 * single env var so test runs (or embedding apps) can control verbosity:
 *
 * - `MOCK_SERVER_LOG_LEVEL` accepts (case-insensitive) `silent`, `error`,
 *   `warn`, `info` or `debug`. Defaults to `info`. `silent` disables all
 *   output; `debug` enables verbose debug output.
 */
import { getSessionToken } from "./requestContext";

type LogMethod = (message: string, ...args: unknown[]) => void;

/** Number of leading token characters shown as the session tag. */
const SESSION_TAG_LENGTH = 8;

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 } as const;
type Level = keyof typeof LEVELS;

const parseLevel = (value: string | undefined): Level => {
  const normalized = value?.toLowerCase();
  return normalized && normalized in LEVELS ? (normalized as Level) : "info";
};

const currentLevel = LEVELS[parseLevel(process.env["MOCK_SERVER_LOG_LEVEL"])];

const sessionTag = (): string => {
  const token = getSessionToken();
  return token ? `<${token.slice(0, SESSION_TAG_LENGTH)}> ` : "";
};

const emit = (
  consoleMethod: LogMethod,
  level: Exclude<Level, "silent">,
  message: string,
  args: unknown[],
): void => {
  if (currentLevel < LEVELS[level]) return;
  consoleMethod(
    `${new Date().toISOString()} ${sessionTag()}${level.toUpperCase()} ${message}`,
    ...args,
  );
};

export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    emit(console.debug, "debug", message, args);
  },
  info: (message: string, ...args: unknown[]): void => {
    emit(console.info, "info", message, args);
  },
  warn: (message: string, ...args: unknown[]): void => {
    emit(console.warn, "warn", message, args);
  },
  error: (message: string, ...args: unknown[]): void => {
    emit(console.error, "error", message, args);
  },
};
