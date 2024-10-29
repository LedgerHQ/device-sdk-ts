import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { type LogSubscriberOptions } from "@api/types";
import { DeviceSession } from "@internal/device-session/model/DeviceSession";

import { type LoggerSubscriberService } from "./LoggerSubscriberService";

/**
 * This function is used to format the logs to JSON format,
 * remove circular dependencies and do some extra formatting.
 * */
export function getJSONStringifyReplacer(): (
  key: string,
  value: unknown,
) => unknown {
  const ancestors: unknown[] = [];
  return function (_: string, value: unknown): unknown {
    // format Uint8Array values to more readable format
    if (value instanceof Uint8Array) {
      const bytesHex = Array.from(value).map((x) =>
        x.toString(16).padStart(2, "0"),
      );
      return {
        hex: "0x" + bytesHex.join(""),
        readableHex: bytesHex.join(" "),
        value: value.toString(),
      };
    }

    // format DeviceSession values to avoid huge object in logs
    if (value instanceof DeviceSession) {
      const {
        connectedDevice: { deviceModel, type, id },
      } = value;
      return {
        id: value.id,
        connectedDevice: {
          deviceModel,
          type,
          id,
        },
      };
    }

    // format circular references to "[Circular]"
    // Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value#circular_references
    if (typeof value !== "object" || value === null) {
      return value;
    }
    // `this` is the object that value is contained in,
    // i.e., its direct parent.
    // @ts-expect-error cf. comment above
    while (ancestors.length > 0 && ancestors.at(-1) !== (this as unknown)) {
      ancestors.pop();
    }
    if (ancestors.includes(value)) {
      return "[Circular]";
    }
    ancestors.push(value);
    return value;
  };
}

export class WebLogsExporterLogger implements LoggerSubscriberService {
  private logs: Array<
    [level: LogLevel, message: string, options: LogSubscriberOptions]
  > = [];

  log(level: LogLevel, message: string, options: LogSubscriberOptions): void {
    this.logs.push([level, message, options]);
  }

  private formatLogsToJSON(): string {
    const remappedLogs = this.logs.map(([level, message, options]) => {
      const { timestamp, ...restOptions } = options;
      return {
        level: LogLevel[level],
        message,
        options: {
          ...restOptions,
          date: new Date(options.timestamp),
        },
      };
    });

    return JSON.stringify(remappedLogs, getJSONStringifyReplacer(), 2);
  }

  /**
   * Export logs to JSON file.
   */
  public exportLogsToJSON(): void {
    const logs = this.formatLogsToJSON();
    const blob = new Blob([logs], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-device-management-kit-logs-${new Date().toISOString()}.json`;
    a.click();
  }
}
