import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { type LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";
import { type LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";

const LEVEL_MAP: Record<number, string> = {
  [LogLevel.Fatal]: "error",
  [LogLevel.Error]: "error",
  [LogLevel.Warning]: "warn",
  [LogLevel.Info]: "info",
  [LogLevel.Debug]: "debug",
};

/**
 * Logger subscriber that pushes logs to a DMK Debugger instance
 * via HTTP POST to `http://localhost:{port}/logs`.
 */
export class DebuggerLogger implements LoggerSubscriberService {
  private readonly url: string;

  constructor(port: number) {
    this.url = `http://localhost:${port}/logs`;
  }

  log(
    level: LogLevel | null,
    message: string,
    options: LogSubscriberOptions,
  ): void {
    const body = JSON.stringify({
      level: LEVEL_MAP[level ?? LogLevel.Debug] ?? "debug",
      message,
      tag: options.tag,
      timestamp: new Date(options.timestamp).toISOString(),
      data: options.data,
    });

    fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {
      // Silently ignore network errors to avoid disrupting the host app
    });
  }
}
