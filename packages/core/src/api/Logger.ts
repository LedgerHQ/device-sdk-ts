import { Log, LoggerSubscriber, LogLevel } from "@internal/logger/service/Log";

export { Log, LogLevel };
export type {
  LogContext,
  LogData,
  LoggerSubscriber,
  LogMessages,
} from "@internal/logger/service/Log";

export class ConsoleLogger implements LoggerSubscriber {
  log(log: Log): void {
    switch (log.level) {
      case LogLevel.Info:
        console.info("[LOGGER]", ...log.messages);
        break;
      case LogLevel.Warning:
        console.warn("[LOGGER]", ...log.messages);
        break;
      case LogLevel.Debug:
        console.debug("[LOGGER]", ...log.messages);
        break;
      case LogLevel.Error:
        console.error("[LOGGER]", ...log.messages);
        break;
      default:
        console.log("[LOGGER]", ...log.messages);
    }
  }
}
