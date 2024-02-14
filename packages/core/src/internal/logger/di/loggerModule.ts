import { ContainerModule } from "inversify";

import { DefaultLoggerService } from "@internal/logger/service/DefaultLoggerService";
import { LoggerSubscriber } from "@internal/logger/service/Log";

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
