import { type LogLevel } from "@api/global/services/logger/model/LogLevel";
import { type LogSubscriberOptions } from "@api/global/services/logger/model/LogSubscriberOptions";

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
