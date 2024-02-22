import { ContainerModule, interfaces } from "inversify";

import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";
import { DefaultLoggerService } from "@internal/logger/service/DefaultLoggerService";
import { LoggerService } from "@internal/logger/service/LoggerService";

import { types } from "./loggerTypes";

type FactoryProps = {
  subscribers: LoggerSubscriber[];
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
      bind<interfaces.Factory<LoggerService>>(
        types.LoggerServiceFactory,
      ).toFactory((_context) => {
        return (tag: string) => new DefaultLoggerService(subscribers, tag);
      });
    },
  );
