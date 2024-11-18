import { ContainerModule } from "inversify";

import { SendApduUseCase } from "@internal/send/use-case/SendApduUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { sendTypes } from "./sendTypes";

type FactoryProps = {
  stub: boolean;
};

export const sendModuleFactory = ({ stub = false }: FactoryProps) =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind(sendTypes.SendApduUseCase).to(SendApduUseCase);
      if (stub) {
        rebind(sendTypes.SendApduUseCase).to(StubUseCase);
      }
    },
  );
