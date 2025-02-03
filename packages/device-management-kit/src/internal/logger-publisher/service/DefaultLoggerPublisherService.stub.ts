import type { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import type { LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";

export class DefaultLoggerPublisherServiceStub
  implements LoggerPublisherService
{
  subscribers: LoggerSubscriberService[] = [];

  _log = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  debug = vi.fn();
  error = vi.fn();
}
