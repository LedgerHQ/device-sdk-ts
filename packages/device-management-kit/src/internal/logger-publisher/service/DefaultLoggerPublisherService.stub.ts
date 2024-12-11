import type { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import type { LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";

export class DefaultLoggerPublisherServiceStub
  implements LoggerPublisherService
{
  subscribers: LoggerSubscriberService[] = [];

  _log = jest.fn();
  info = jest.fn();
  warn = jest.fn();
  debug = jest.fn();
  error = jest.fn();
}
