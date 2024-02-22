import { ContainerModule } from "inversify";

import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";
import { DefaultLoggerService } from "@internal/logger/service/DefaultLoggerService";

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
      bind(types.LoggerService).toConstantValue(
        new DefaultLoggerService(subscribers),
      );
    },
  );
