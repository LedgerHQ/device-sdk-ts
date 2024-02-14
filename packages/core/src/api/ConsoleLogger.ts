import { Log, LoggerSubscriber, LogLevel } from "@internal/logger/service/Log";

import { SdkError } from "./Error";

export { Log, LogLevel };
export type {
  LogContext,
  LogData,
  LoggerSubscriber,
  LogMessage,
} from "@internal/logger/service/Log";

export class ConsoleLogger implements LoggerSubscriber {
  log(level: LogLevel, log: Log): void {
    switch (level) {
      case LogLevel.Info:
        console.info("[LOGGER]", ...log.messages);
        break;
      case LogLevel.Warning:
        console.warn("[LOGGER]", ...log.messages);
        break;
      case LogLevel.Debug:
        console.debug("[LOGGER]", ...log.messages);
        break;
      case LogLevel.Error: {
        const { type, tag } = log.context;
        if (type === "error" && tag) {
          const { error } = log.data as { error: SdkError };
          const { originalError } = error;
          console.warn("[LOGGER]", ...log.messages);
          console.error(originalError ?? error);
          break;
        }

        if (type === "error" && !tag) {
          const { error } = log.data as { error: Error };
          console.warn("[LOGGER]", ...log.messages);
          console.error(error);
          break;
        }

        console.warn("[LOGGER]", "[type !== 'error']", ...log.messages);
        break;
      }
      default:
        console.log("[LOGGER]", ...log.messages);
    }
  }
}
