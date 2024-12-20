import { type LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { type LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";

/**
 * Logger subscriber service.
 *
 * Implement this interface and use `DeviceManagementKitBuilder.addLogger` to
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
