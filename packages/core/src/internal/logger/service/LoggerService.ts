import { LogOptions } from "@api/logger-subscriber/model/LogOptions";
import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";

export interface LoggerService {
  subscribers: LoggerSubscriber[];

  error(message: string, options?: LogOptions): void;
  warn(message: string, options?: LogOptions): void;
  info(message: string, options?: LogOptions): void;
  debug(message: string, options?: LogOptions): void;
}
