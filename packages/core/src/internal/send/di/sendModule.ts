import { ContainerModule } from "inversify";

import { SendApduUseCase } from "@internal/send/use-case/SendApduUseCase";

import { sendTypes } from "./sendTypes";

type FactoryProps = {
  stub: boolean;
};

export const sendModuleFactory = (_args: Partial<FactoryProps> = {}) =>
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
      bind(sendTypes.SendApduUseCase).to(SendApduUseCase);
    },
  );
