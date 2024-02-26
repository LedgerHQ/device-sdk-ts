import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";
import { LogPublisherOptions } from "@internal/logger-publisher/model/LogPublisherOptions";

export interface LoggerPublisherService {
  subscribers: LoggerSubscriber[];

  error(message: string, options?: LogPublisherOptions): void;
  warn(message: string, options?: LogPublisherOptions): void;
  info(message: string, options?: LogPublisherOptions): void;
  debug(message: string, options?: LogPublisherOptions): void;
}
