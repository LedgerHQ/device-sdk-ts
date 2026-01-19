import { type LogParams, LogLevel } from "@ledgerhq/device-management-kit";
import { DevToolsLog } from "./DevToolsLog";

export function mapDmkLogToDevToolsLog(dmkLog: LogParams): DevToolsLog {
  const [level, message, options] = dmkLog;

  const verbosities: Record<LogLevel, DevToolsLog["verbosity"]> = {
    [LogLevel.Debug]: "debug",
    [LogLevel.Info]: "info",
    [LogLevel.Warning]: "warning",
    [LogLevel.Error]: "error",
    [LogLevel.Fatal]: "fatal",
  };

  let payloadJSON = "";
  try {
    payloadJSON = JSON.stringify(options.data || {}, null);
  } catch (e) {
    console.error("Failed to stringify log data", e);
  }

  return {
    timestamp: new Date(options.timestamp).toISOString(),
    tag: options.tag,
    message: message,
    verbosity: verbosities[level],
    payloadJSON,
  };
}
