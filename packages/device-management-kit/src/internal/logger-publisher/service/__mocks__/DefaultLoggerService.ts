import { type LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export class DefaultLoggerPublisherService implements LoggerPublisherService {
  subscribers: LoggerSubscriberService[] = [];

  _log = jest.fn();
  info = jest.fn();
  warn = jest.fn();
  debug = jest.fn();
  error = jest.fn();
}
