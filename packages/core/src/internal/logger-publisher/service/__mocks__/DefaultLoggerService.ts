import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

export class DefaultLoggerPublisherService implements LoggerPublisherService {
  subscribers: LoggerSubscriber[] = [];

  _log = jest.fn();
  info = jest.fn();
  warn = jest.fn();
  debug = jest.fn();
  error = jest.fn();
}
