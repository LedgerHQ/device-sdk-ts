import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogOptions } from "@api/logger-subscriber/model/LogOptions";

export interface LoggerSubscriber {
  log(level: LogLevel, message: string, options?: LogOptions): void;
}
