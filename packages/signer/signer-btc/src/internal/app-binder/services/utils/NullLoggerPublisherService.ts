import type { LoggerPublisherService } from "@ledgerhq/device-management-kit";

export const NullLoggerPublisherService: (
  tag: string,
) => LoggerPublisherService = (_tag: string) => ({
  debug: () => {
    // no-op
  },
  info: () => {
    // no-op
  },
  warn: () => {
    // no-op
  },
  error: () => {
    // no-op
  },
  subscribers: [],
});
