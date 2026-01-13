import { LogLevel } from "@ledgerhq/device-management-kit";

export type CliLogLevel = "none" | "error" | "warn" | "info" | "debug";

export const CLI_LOG_LEVELS: CliLogLevel[] = [
  "none",
  "error",
  "warn",
  "info",
  "debug",
];

export type LoggerConfig = {
  cli: {
    level: CliLogLevel;
  };
  file?: {
    level: CliLogLevel;
    filePath: string;
  };
};

export function parseLogLevel(level: CliLogLevel): LogLevel | null {
  switch (level) {
    case "none":
      return null;
    case "error":
      return LogLevel.Error;
    case "warn":
      return LogLevel.Warning;
    case "info":
      return LogLevel.Info;
    case "debug":
      return LogLevel.Debug;
  }
}
