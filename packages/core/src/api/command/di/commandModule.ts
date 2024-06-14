import { ContainerModule } from "inversify";

import { SendCommandUseCase } from "@api/command/use-case/SendCommandUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { commandTypes } from "./commandTypes";

type CommandModuleArgs = Partial<{
  stub: boolean;
}>;

export const commandModuleFactory = ({
  stub = false,
}: CommandModuleArgs = {}) =>
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
      bind(commandTypes.SendCommandUseCase).to(SendCommandUseCase);
      if (stub) {
        rebind(commandTypes.SendCommandUseCase).to(StubUseCase);
      }
    },
  );
