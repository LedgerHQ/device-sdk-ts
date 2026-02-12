import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";

/**
 * A no-op logger that silently discards all log messages.
 * Useful as a default when no logger is configured.
 */
export const noopLogger: LoggerPublisherService = {
  subscribers: [],
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * A logger factory that always returns a no-op logger, regardless of the tag.
 * Use this as a fallback when no logger factory is provided.
 */
export const noopLoggerFactory = (_tag: string): LoggerPublisherService =>
  noopLogger;
