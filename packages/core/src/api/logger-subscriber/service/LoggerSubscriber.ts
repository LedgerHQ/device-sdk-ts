import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";

export interface LoggerSubscriber {
  log(level: LogLevel, message: string, options: LogSubscriberOptions): void;
}
