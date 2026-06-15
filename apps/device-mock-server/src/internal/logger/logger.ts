/**
 * Minimal console logger for the mock server.
 *
 * Kept intentionally simple: it prefixes a timestamp, the originating session
 * tag (when logging within a request) and the level, and is gated by two env
 * vars so test runs (or embedding apps) can stay quiet:
 *
 * - `MOCK_SERVER_SILENT=1` disables all output.
 * - `MOCK_SERVER_DEBUG=1` enables `debug` output (off by default).
 */
import { getSessionToken } from "./requestContext";

type LogMethod = (message: string, ...args: unknown[]) => void;

/** Number of leading token characters shown as the session tag. */
const SESSION_TAG_LENGTH = 8;

const isEnabled = (name: string): boolean => {
  const value = process.env[name];
  return value === "1" || value === "true";
};

const silent = isEnabled("MOCK_SERVER_SILENT");
const debugEnabled = isEnabled("MOCK_SERVER_DEBUG");

const sessionTag = (): string => {
  const token = getSessionToken();
  return token ? `<${token.slice(0, SESSION_TAG_LENGTH)}> ` : "";
};

const emit = (
  consoleMethod: LogMethod,
  level: string,
  message: string,
  args: unknown[],
): void => {
  if (silent) return;
  consoleMethod(
    `${new Date().toISOString()} ${sessionTag()}${level} ${message}`,
    ...args,
  );
};

export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    if (!debugEnabled) return;
    emit(console.debug, "DEBUG", message, args);
  },
  info: (message: string, ...args: unknown[]): void => {
    emit(console.info, "INFO", message, args);
  },
  warn: (message: string, ...args: unknown[]): void => {
    emit(console.warn, "WARN", message, args);
  },
  error: (message: string, ...args: unknown[]): void => {
    emit(console.error, "ERROR", message, args);
  },
};
