import {
  LoggerPublisherService as LoggerPublisherServiceBase,
  LoggerSubscriberService,
  LogLevel,
} from "@ledgerhq/device-management-kit";
import { injectable } from "inversify";

@injectable()
export class LoggerPublisherService implements LoggerPublisherServiceBase {
  subscribers: LoggerSubscriberService[];
  tag: string;

  constructor(subscribers: LoggerSubscriberService[], tag: string) {
    this.subscribers = subscribers;
    this.tag = tag;
  }

  _log(
    level: LogLevel,
    message: string,
    data?: { [key: string]: unknown },
  ): void {
    this.subscribers.forEach((subscriber) => {
      const subscriberOptions = {
        timestamp: Date.now(),
        tag: this.tag,
        data,
      };
      subscriber.log(level, message, subscriberOptions);
    });
  }

  info(message: string, data?: { [key: string]: unknown }): void {
    this._log(LogLevel.Info, message, data);
  }

  warn(message: string, data?: { [key: string]: unknown }): void {
    this._log(LogLevel.Warning, message, data);
  }

  debug(message: string, data?: { [key: string]: unknown }): void {
    this._log(LogLevel.Debug, message, data);
  }

  error(message: string, data?: { [key: string]: unknown }): void {
    this._log(LogLevel.Error, message, data);
  }
}
