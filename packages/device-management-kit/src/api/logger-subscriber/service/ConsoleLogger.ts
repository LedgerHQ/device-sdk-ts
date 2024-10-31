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
    const tag = `[${options.tag}]`;

    switch (level) {
      case LogLevel.Info: {
        if (this.maxLevel >= LogLevel.Info) {
          console.info(tag, message, options.data);
        }
        break;
      }
      case LogLevel.Warning: {
        if (this.maxLevel >= LogLevel.Warning) {
          console.warn(tag, message, options.data);
        }
        break;
      }
      case LogLevel.Debug: {
        if (this.maxLevel >= LogLevel.Debug) {
          console.debug(tag, message, options.data);
        }
        break;
      }
      case LogLevel.Error: {
        if (this.maxLevel >= LogLevel.Error) {
          console.error(tag, message, options.data);
        }
        break;
      }
      case LogLevel.Fatal: {
        if (this.maxLevel >= LogLevel.Fatal) {
          console.error(tag, message, options.data);
        }
        break;
      }
      default:
        console.log(tag, message, options.data);
    }
  }
}
