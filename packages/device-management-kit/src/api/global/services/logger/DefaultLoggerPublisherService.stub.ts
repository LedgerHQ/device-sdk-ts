import type { LoggerPublisherService } from "@api/global/services/logger/LoggerPublisherService";

export class DefaultLoggerPublisherServiceStub
  implements LoggerPublisherService
{
  _log = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  debug = vi.fn();
  error = vi.fn();
}
