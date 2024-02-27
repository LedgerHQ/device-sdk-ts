import { ContainerModule, interfaces } from "inversify";

import { LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { types } from "./loggerTypes";

type FactoryProps = {
  subscribers: LoggerSubscriberService[];
};

export const loggerModuleFactory = (
  { subscribers }: FactoryProps = { subscribers: [] },
) =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      _rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind<interfaces.Factory<LoggerPublisherService>>(
        types.LoggerPublisherServiceFactory,
      ).toFactory((_context) => {
        return (tag: string) =>
          new DefaultLoggerPublisherService(subscribers, tag);
      });
    },
  );
