import { type LogPublisherOptions } from "@api/global/services/logger/model/LogPublisherOptions";

export interface LoggerPublisherService {
  error(message: string, options?: LogPublisherOptions): void;
  warn(message: string, options?: LogPublisherOptions): void;
  info(message: string, options?: LogPublisherOptions): void;
  debug(message: string, options?: LogPublisherOptions): void;
}
