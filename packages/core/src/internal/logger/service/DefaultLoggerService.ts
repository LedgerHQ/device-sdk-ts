import { injectable } from "inversify";

import { Log, LoggerSubscriber, LogLevel } from "./Log";
import { LoggerService } from "./LoggerService";

@injectable()
export class DefaultLoggerService implements LoggerService {
  subscribers: LoggerSubscriber[];
  constructor(subscribers: LoggerSubscriber[]) {
    this.subscribers = subscribers;
  }

  _log(level: LogLevel, log: Log): void {
    this.subscribers.forEach((subscriber) => {
      subscriber.log(level, log);
    });
  }

  info(log: Log): void {
    this._log(LogLevel.Info, log);
  }

  warn(log: Log): void {
    this._log(LogLevel.Warning, log);
  }

  debug(log: Log): void {
    this._log(LogLevel.Debug, log);
  }

  error(log: Log): void {
    this._log(LogLevel.Error, log);
  }
}
