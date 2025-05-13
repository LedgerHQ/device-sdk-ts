import { ContainerModule } from "inversify";

import { SendApduUseCase } from "@internal/send/use-case/SendApduUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { sendTypes } from "./sendTypes";

type FactoryProps = {
  stub: boolean;
};

export const sendModuleFactory = ({ stub = false }: FactoryProps) =>
  new ContainerModule(({ bind, rebindSync }) => {
    bind(sendTypes.SendApduUseCase).to(SendApduUseCase);
    if (stub) {
      rebindSync(sendTypes.SendApduUseCase).to(StubUseCase);
    }
  });
