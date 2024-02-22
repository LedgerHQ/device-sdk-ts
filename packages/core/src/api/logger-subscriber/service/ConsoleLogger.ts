import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogOptions } from "@api/logger-subscriber/model/LogOptions";
import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";

export class ConsoleLogger implements LoggerSubscriber {
  log(level: LogLevel, message: string, _options: LogOptions): void {
    switch (level) {
      case LogLevel.Info:
        console.info("[LOGGER]", message);
        break;
      case LogLevel.Warning:
        console.warn("[LOGGER]", message);
        break;
      case LogLevel.Debug:
        console.debug("[LOGGER]", message);
        break;
      case LogLevel.Error: {
        console.error("[LOGGER]", message);
        break;
      }
      default:
        console.log("[LOGGER]", message);
    }
  }
}
