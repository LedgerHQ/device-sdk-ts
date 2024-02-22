import { injectable } from "inversify";

import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogOptions } from "@api/logger-subscriber/model/LogOptions";
import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";

import { LoggerService } from "./LoggerService";

@injectable()
export class DefaultLoggerService implements LoggerService {
  subscribers: LoggerSubscriber[];
  tag: string;

  constructor(subscribers: LoggerSubscriber[], tag: string) {
    this.subscribers = subscribers;
    this.tag = tag;
  }

  _log(level: LogLevel, message: string, options?: LogOptions): void {
    this.subscribers.forEach((subscriber) => {
      subscriber.log(level, message, { tag: this.tag, ...options });
    });
  }

  info(message: string, options?: LogOptions): void {
    this._log(LogLevel.Info, message, options);
  }

  warn(message: string, options?: LogOptions): void {
    this._log(LogLevel.Warning, message, options);
  }

  debug(message: string, options?: LogOptions): void {
    this._log(LogLevel.Debug, message, options);
  }

  error(message: string, options?: LogOptions): void {
    this._log(LogLevel.Error, message, options);
  }
}
