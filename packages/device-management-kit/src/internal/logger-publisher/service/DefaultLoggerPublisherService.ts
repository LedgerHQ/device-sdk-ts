import { injectable } from "inversify";

import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";
import { LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";
import { LogPublisherOptions } from "@internal/logger-publisher/model/LogPublisherOptions";
import { sanitiseData } from "@internal/logger-publisher/service/sanitiseData";

@injectable()
export class DefaultLoggerPublisherService implements LoggerPublisherService {
  subscribers: LoggerSubscriberService[];
  tag: string;

  constructor(subscribers: LoggerSubscriberService[], tag: string) {
    this.subscribers = subscribers;
    this.tag = tag;
  }

  _log(level: LogLevel, message: string, options?: LogPublisherOptions): void {
    const sanitisedData = options?.data
      ? sanitiseData(options.data)
      : undefined;

    this.subscribers.forEach((subscriber) => {
      const subscriberOptions: LogSubscriberOptions = {
        timestamp: Date.now(),
        tag: this.tag,
        ...options,
        data: sanitisedData,
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
