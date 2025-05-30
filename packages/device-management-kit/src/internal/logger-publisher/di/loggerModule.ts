import { ContainerModule, type Factory } from "inversify";

import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";

import { loggerTypes } from "./loggerTypes";

type FactoryProps = {
  subscribers: LoggerSubscriberService[];
};

export const loggerModuleFactory = (
  { subscribers }: FactoryProps = { subscribers: [] },
) =>
  new ContainerModule(({ bind }) => {
    bind<Factory<LoggerPublisherService>>(
      loggerTypes.LoggerPublisherServiceFactory,
    ).toFactory((_context) => {
      return (tag: string) =>
        new DefaultLoggerPublisherService(subscribers, tag);
    });
  });
