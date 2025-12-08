import {
  type LoggerSubscriberService,
  LogLevel,
  type LogParams,
} from "@ledgerhq/device-management-kit";

import { type Connector } from "./types";

export type DevToolsLog = {
  /** ISO 8601 timestamp */
  timestamp: string;
  tag: string;
  verbosity: "debug" | "info" | "warning" | "error" | "fatal";
  message: string;
  payloadJSON: string; // extra data, can be an empty string
};

function mapDmkLogToDevToolsLog(dmkLog: LogParams): DevToolsLog {
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

export class DevToolsLogger implements LoggerSubscriberService {
  constructor(private readonly connector: Connector) {}

  log(...logParams: LogParams): void {
    this.connector.sendMessage(
      "addLog",
      JSON.stringify(mapDmkLogToDevToolsLog(logParams)),
    );
  }
}
