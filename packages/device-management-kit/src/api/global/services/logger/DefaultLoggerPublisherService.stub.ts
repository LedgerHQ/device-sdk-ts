import type { LoggerPublisherService } from "@api/global/services/logger/LoggerPublisherService";
import type { LoggerSubscriberService } from "@api/global/services/logger/LoggerSubscriberService";

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
