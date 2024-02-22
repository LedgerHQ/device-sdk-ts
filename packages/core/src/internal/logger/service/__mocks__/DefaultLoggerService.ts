import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";
import type { LoggerService } from "@internal/logger/service/LoggerService";

export class DefaultLoggerService implements LoggerService {
  subscribers: LoggerSubscriber[] = [];

  _log = jest.fn();
  info = jest.fn();
  warn = jest.fn();
  debug = jest.fn();
  error = jest.fn();
}
