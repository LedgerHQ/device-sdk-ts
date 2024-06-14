import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";
import { LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";

export class ConsoleLogger implements LoggerSubscriberService {
  log(level: LogLevel, message: string, options: LogSubscriberOptions): void {
    const tag = `[${options.tag}]`;

    switch (level) {
      case LogLevel.Info:
        console.info(tag, message, options.data);
        break;
      case LogLevel.Warning:
        console.warn(tag, message, options.data);
        break;
      case LogLevel.Debug:
        console.debug(tag, message, options.data);
        break;
      case LogLevel.Error: {
        console.error(tag, message, options.data);
        break;
      }
      default:
        console.log(tag, message, options.data);
    }
  }
}
