import { ContainerModule } from "inversify";

import { SendCommandUseCase } from "@api/command/use-case/SendCommandUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { commandTypes } from "./commandTypes";

type CommandModuleArgs = Partial<{
  readonly stub: boolean;
}>;

export const commandModuleFactory = ({
  stub = false,
}: CommandModuleArgs = {}) =>
  new ContainerModule(({ bind, rebindSync }) => {
    bind(commandTypes.SendCommandUseCase).to(SendCommandUseCase);
    if (stub) {
      rebindSync(commandTypes.SendCommandUseCase).to(StubUseCase);
    }
  });
