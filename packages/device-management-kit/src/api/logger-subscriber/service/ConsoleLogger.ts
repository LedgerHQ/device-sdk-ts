import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import {
  type LogSubscriberData,
  type LogSubscriberOptions,
} from "@api/logger-subscriber/model/LogSubscriberOptions";
import { type LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";
import { bufferToHexaString } from "@api/utils/HexaString";

const isObject = (data: unknown): data is object =>
  typeof data === "object" && data !== null && !Array.isArray(data);

export class ConsoleLogger implements LoggerSubscriberService {
  private readonly maxLevel: LogLevel;

  constructor(level: LogLevel = LogLevel.Debug) {
    this.maxLevel = level;
  }

  private _formatLogData(data: LogSubscriberData | object): LogSubscriberData {
    return Object.entries(data).reduce<LogSubscriberData>(
      (acc, [key, value]) => {
        if (value instanceof Uint8Array) {
          acc[key] = bufferToHexaString(value);
        } else if (isObject(value)) {
          acc[key] = this._formatLogData(value);
        } else {
          acc[key] = value;
        }
        return acc;
      },
      {},
    );
  }

  log(
    level: LogLevel | null,
    message: string,
    options: LogSubscriberOptions,
  ): void {
    const tag = `[${options.tag}]`;
    const args: Array<string | LogSubscriberData> = [tag, message];

    if (options.data) {
      args.push(this._formatLogData(options.data));
    }

    switch (level) {
      case LogLevel.Info: {
        if (this.maxLevel >= LogLevel.Info) {
          console.info(...args);
        }
        break;
      }
      case LogLevel.Warning: {
        if (this.maxLevel >= LogLevel.Warning) {
          console.warn(...args);
        }
        break;
      }
      case LogLevel.Debug: {
        if (this.maxLevel >= LogLevel.Debug) {
          console.debug(...args);
        }
        break;
      }
      case LogLevel.Verbose: {
        if (this.maxLevel >= LogLevel.Verbose) {
          console.debug(...args);
        }
        break;
      }
      case LogLevel.Error: {
        if (this.maxLevel >= LogLevel.Error) {
          console.error(...args);
        }
        break;
      }
      case LogLevel.Fatal: {
        if (this.maxLevel >= LogLevel.Fatal) {
          console.error(...args);
        }
        break;
      }
      default:
        console.log(...args);
    }
  }
}
