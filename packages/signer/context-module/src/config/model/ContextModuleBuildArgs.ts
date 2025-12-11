import { type GetContextModuleLoggerPublisherService } from "./ContextModuleConfig";

export type ContextModuleConstructorArgs = {
  originToken?: string;
  loggerFactory?: GetContextModuleLoggerPublisherService;
};
