import { injectable } from "inversify";

import { Log, LoggerSubscriber, LogLevel } from "./Log";
import { LoggerService } from "./LoggerService";

@injectable()
export class DefaultLoggerService implements LoggerService {
  subscribers: LoggerSubscriber[];
  constructor(subscribers: LoggerSubscriber[]) {
    this.subscribers = subscribers;
  }

  _log(log: Log): void {
    this.subscribers.forEach((subscriber) => {
      subscriber.log(log);
    });
  }

  info(log: Log): void {
    log.setLevel(LogLevel.Info);
    this._log(log);
  }

  warn(log: Log): void {
    log.setLevel(LogLevel.Warning);
    this._log(log);
  }

  debug(log: Log): void {
    log.setLevel(LogLevel.Debug);
    this._log(log);
  }

  error(log: Log): void {
    log.setLevel(LogLevel.Error);
    this._log(log);
  }
}
