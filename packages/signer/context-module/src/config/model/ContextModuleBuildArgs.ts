import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

export type ContextModuleConstructorArgs = {
  originToken?: string;
  loggerFactory: (tag: string) => LoggerPublisherService;
};
