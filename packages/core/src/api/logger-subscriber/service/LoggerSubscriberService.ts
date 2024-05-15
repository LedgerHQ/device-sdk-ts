import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";

/**
 * Logger subscriber service.
 *
 * Implement this interface and use `LedgerDeviceSdkBuilder.addLogger` to
 * receive logs from the SDK.
 */
export interface LoggerSubscriberService {
  log(level: LogLevel, message: string, options: LogSubscriberOptions): void;
}
