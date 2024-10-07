import { LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";

export type DMKFlipperPlugin = {
  loggerSubscriberService: LoggerSubscriberService;
  // deviceSessionStateSubscribtionService: DeviceSessionStateSubscribtionService; // TODO later
};
