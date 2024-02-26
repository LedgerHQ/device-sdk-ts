import { LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";
import { LogPublisherOptions } from "@internal/logger-publisher/model/LogPublisherOptions";

export interface LoggerPublisherService {
  subscribers: LoggerSubscriberService[];

  error(message: string, options?: LogPublisherOptions): void;
  warn(message: string, options?: LogPublisherOptions): void;
  info(message: string, options?: LogPublisherOptions): void;
  debug(message: string, options?: LogPublisherOptions): void;
}
