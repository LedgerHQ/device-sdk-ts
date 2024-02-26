import { injectable } from "inversify";

import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";
import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";
import { LogPublisherOptions } from "@internal/logger-publisher/model/LogPublisherOptions";

import { LoggerPublisherService } from "./LoggerPublisherService";

@injectable()
export class DefaultLoggerPublisherService implements LoggerPublisherService {
  subscribers: LoggerSubscriber[];
  tag: string;

  constructor(subscribers: LoggerSubscriber[], tag: string) {
    this.subscribers = subscribers;
    this.tag = tag;
  }

  _log(level: LogLevel, message: string, options?: LogPublisherOptions): void {
    this.subscribers.forEach((subscriber) => {
      const subscriberOptions: LogSubscriberOptions = {
        timestamp: Date.now(),
        tag: this.tag,
        ...options,
      };
      subscriber.log(level, message, subscriberOptions);
    });
  }

  info(message: string, options?: LogPublisherOptions): void {
    this._log(LogLevel.Info, message, options);
  }

  warn(message: string, options?: LogPublisherOptions): void {
    this._log(LogLevel.Warning, message, options);
  }

  debug(message: string, options?: LogPublisherOptions): void {
    this._log(LogLevel.Debug, message, options);
  }

  error(message: string, options?: LogPublisherOptions): void {
    this._log(LogLevel.Error, message, options);
  }
}
