import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { type LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";
import { type LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";

export class ConsoleLogger implements LoggerSubscriberService {
  private readonly maxLevel: LogLevel;

  constructor(level: LogLevel = LogLevel.Debug) {
    this.maxLevel = level;
  }

  log(
    level: LogLevel | null,
    message: string,
    options: LogSubscriberOptions,
  ): void {
    const tag = options.tag;

    switch (level) {
      case LogLevel.Info: {
        if (this.maxLevel >= LogLevel.Info) {
          this.logWithData(tag, console.info, message, options);
        }
        break;
      }
      case LogLevel.Warning: {
        if (this.maxLevel >= LogLevel.Warning) {
          this.logWithData(tag, console.warn, message, options);
        }
        break;
      }
      case LogLevel.Debug: {
        if (this.maxLevel >= LogLevel.Debug) {
          this.logWithData(tag, console.debug, message, options);
        }
        break;
      }
      case LogLevel.Error: {
        if (this.maxLevel >= LogLevel.Error) {
          this.logWithData(tag, console.error, message, options);
        }
        break;
      }
      case LogLevel.Fatal: {
        if (this.maxLevel >= LogLevel.Fatal) {
          this.logWithData(tag, console.error, message, options);
        }
        break;
      }
      default:
        this.logWithData(tag, console.log, message, options);
    }
  }

  private logWithData(
    tag: string,
    logFunction: (...args: unknown[]) => void,
    message: string,
    options: LogSubscriberOptions,
  ): void {
    if (options.data) {
      logFunction(tag, message, options.data);
    } else {
      logFunction(tag, message);
    }
  }
}
