import { LoggerSubscriber } from "@internal/logger/service/Log";
import { LoggerService } from "@internal/logger/service/LoggerService";

export class DefaultLoggerService implements LoggerService {
  subscribers: LoggerSubscriber[] = [];

  _log = jest.fn();
  info = jest.fn();
  warn = jest.fn();
  debug = jest.fn();
  error = jest.fn();
}
