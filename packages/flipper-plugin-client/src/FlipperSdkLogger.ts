import {
  type LoggerSubscriberService,
  LogLevel,
  type LogParams,
} from "@ledgerhq/device-management-kit";
import { ReplaySubject } from "rxjs";

type FlipperObjLog = {
  /** ISO 8601 timestamp */
  timestamp: string;
  tag: string;
  verbosity: "debug" | "info" | "warning" | "error" | "fatal";
  message: string;
  payloadJSON: string; // extra data, can be an empty string
};

function mapSdkLogToFlipperObjLog(sdkLog: LogParams): FlipperObjLog {
  const [level, message, options] = sdkLog;

  const verbosities: Record<LogLevel, FlipperObjLog["verbosity"]> = {
    [LogLevel.Debug]: "debug",
    [LogLevel.Info]: "info",
    [LogLevel.Warning]: "warning",
    [LogLevel.Error]: "error",
    [LogLevel.Fatal]: "fatal",
  };

  let payloadJSON = "";
  try {
    payloadJSON = JSON.stringify(options.data || {});
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

export class FlipperSdkLogger implements LoggerSubscriberService {
  /**
   * A ReplaySubject allows the plugin to receive all the logs that were emitted
   * before the connection was established.
   */
  private logsSubject = new ReplaySubject<FlipperObjLog>();

  log(...logParams: LogParams) {
    this.logsSubject.next(mapSdkLogToFlipperObjLog(logParams));
  }

  subscribeToLogs(callback: (log: FlipperObjLog) => void) {
    return this.logsSubject.subscribe(callback);
  }
}
