import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogOptions } from "@api/logger-subscriber/model/LogOptions";
import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";

export class ConsoleLogger implements LoggerSubscriber {
  log(level: LogLevel, message: string, options: LogOptions): void {
    const tag = `[${options.tag ?? "logger"}]`;

    switch (level) {
      case LogLevel.Info:
        console.info(tag, message);
        break;
      case LogLevel.Warning:
        console.warn(tag, message);
        break;
      case LogLevel.Debug:
        console.debug(tag, message);
        break;
      case LogLevel.Error: {
        console.error(tag, message);
        break;
      }
      default:
        console.log(tag, message);
    }
  }
}
