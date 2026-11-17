import { ctx } from "@api/global/global";
import { type LoggerPublisherService } from "@api/global/services/logger/LoggerPublisherService";
import { type LoggerSubscriberService } from "@api/global/services/logger/LoggerSubscriberService";

/** Called when the DMK is built. The last built DMK wins. */
export const setLoggerSubscribers = (next: LoggerSubscriberService[]): void =>
  ctx.service.logger.setSubscribers(next);

/**
 * The way to get a logger in every layer (DMK, transports, signers, context
 * module). Safe at module load; logs go to the subscribers added with
 * `DeviceManagementKitBuilder.addLogger`.
 */
export const getLogger = (...tags: string[]): LoggerPublisherService =>
  ctx.service.logger.getLogger(...tags);
