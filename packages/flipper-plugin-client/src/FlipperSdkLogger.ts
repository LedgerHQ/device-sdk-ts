import {
  type LoggerSubscriberService,
  LogLevel,
  type LogParams,
} from "@ledgerhq/device-management-kit";
import { FlipperPluginConnection } from "js-flipper";
import { ReplaySubject, Subscription } from "rxjs";

import { FlipperPluginManager } from "./FlipperPluginManager";

export type FlipperObjLog = {
  /** ISO 8601 timestamp */
  timestamp: string;
  tag: string;
  verbosity: "debug" | "info" | "warning" | "error" | "fatal";
  message: string;
  payloadJSON: string; // extra data, can be an empty string
};

/**
 * Custom JSON.stringify formatter for Uint8Array objects.
 */
function stringifyUint8ArrayFormatter(_: string, value: unknown) {
  if (value instanceof Uint8Array) {
    const bytesHex = Array.from(value).map((x) =>
      x.toString(16).padStart(2, "0"),
    );
    return {
      hex: "0x" + bytesHex.join(""),
      readableHex: bytesHex.join(" "),
      value: Array.from(value),
    };
  }
  return value;
}

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
    payloadJSON = JSON.stringify(
      options.data || {},
      stringifyUint8ArrayFormatter,
    );
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

  constructor(
    flipperPluginManager: FlipperPluginManager = FlipperPluginManager.getInstance(),
  ) {
    const flipperPluginConnection =
      flipperPluginManager.getFlipperPluginConnection();
    if (flipperPluginConnection) {
      this.onConnectFlipperPlugin(flipperPluginConnection);
    }
    flipperPluginManager.addConnectListener(
      this.onConnectFlipperPlugin.bind(this),
    );
    flipperPluginManager.addDisconnectListener(
      this.onDisconnectFlipperPlugin.bind(this),
    );
  }

  private activeSubscription: Subscription | null = null;

  private onConnectFlipperPlugin(
    flipperPluginConnection: FlipperPluginConnection,
  ) {
    this.activeSubscription?.unsubscribe(); // NOTE: this cleanup is necessary to avoid sending double events on reconnection (in cases onDisconnect has not been called)
    this.logsSubject.subscribe((log) => {
      flipperPluginConnection.send("addLog", log);
    });
  }

  private onDisconnectFlipperPlugin() {
    this.activeSubscription?.unsubscribe();
  }

  public log(...logParams: LogParams) {
    this.logsSubject.next(mapSdkLogToFlipperObjLog(logParams));
  }
}
