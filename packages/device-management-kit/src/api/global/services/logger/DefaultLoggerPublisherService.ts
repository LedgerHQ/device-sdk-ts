import { injectable } from "inversify";

import { DefaultLogTagFormatter } from "@api/global/services/logger/DefaultLogTagFormatter";
import { LoggerPublisherService } from "@api/global/services/logger/LoggerPublisherService";
import { LoggerSubscriberService } from "@api/global/services/logger/LoggerSubscriberService";
import { type LogTagFormatter } from "@api/global/services/logger/LogTagFormatter";
import { LogLevel } from "@api/global/services/logger/model/LogLevel";
import { LogPublisherOptions } from "@api/global/services/logger/model/LogPublisherOptions";
import {
  type LogSubscriberOptions,
  type LogTag,
} from "@api/global/services/logger/model/LogSubscriberOptions";
import { sanitiseData } from "@api/global/services/logger/utils/sanitiseData";

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
        tags: [tagToFormat].flat(),
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
