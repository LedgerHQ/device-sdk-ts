import { injectable } from "inversify";

import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import {
  type LogSubscriberOptions,
  type LogTag,
} from "@api/logger-subscriber/model/LogSubscriberOptions";
import { DefaultLogTagFormatter } from "@api/logger-subscriber/service/DefaultLogTagFormatter";
import { LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";
import { type LogTagFormatter } from "@api/logger-subscriber/service/LogTagFormatter";
import { LogPublisherOptions } from "@internal/logger-publisher/model/LogPublisherOptions";
import { sanitiseData } from "@internal/logger-publisher/service/sanitiseData";

@injectable()
export class DefaultLoggerPublisherService implements LoggerPublisherService {
  subscribers: LoggerSubscriberService[];
  tag: LogTag;
  private readonly tagFormatter: LogTagFormatter;

  constructor(
    subscribers: LoggerSubscriberService[],
    tag: LogTag,
    tagFormatter: LogTagFormatter = new DefaultLogTagFormatter(),
  ) {
    this.subscribers = subscribers;
    this.tag = tag;
    this.tagFormatter = tagFormatter;
  }

  _log(level: LogLevel, message: string, options?: LogPublisherOptions): void {
    const sanitisedData = options?.data
      ? sanitiseData(options.data)
      : undefined;

    // Format the tag from options if provided, otherwise use the instance tag
    const tagToFormat = options?.tag ?? this.tag;
    const formattedTag = this.tagFormatter.format(tagToFormat);

    this.subscribers.forEach((subscriber) => {
      const subscriberOptions: LogSubscriberOptions = {
        timestamp: options?.timestamp ?? Date.now(),
        tag: formattedTag,
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
