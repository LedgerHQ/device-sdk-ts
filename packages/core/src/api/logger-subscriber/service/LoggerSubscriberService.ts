import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";

/**
 * Logger subscriber service.
 *
 * Implement this interface and use `LedgerDeviceSdkBuilder.addLogger` to
 * receive logs from the SDK.
 */
export type LogParams = [
  level: LogLevel,
  message: string,
  options: LogSubscriberOptions,
];

export interface LoggerSubscriberService {
  log(...logParams: LogParams): void;
}
