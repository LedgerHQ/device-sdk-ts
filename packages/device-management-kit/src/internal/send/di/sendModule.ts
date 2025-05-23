import { ContainerModule } from "inversify";

import { SendApduUseCase } from "@internal/send/use-case/SendApduUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { sendTypes } from "./sendTypes";
import { ExchangeBulkApdusUseCase } from "../use-case/ExchangeBulkApdusUseCase";

type FactoryProps = {
  stub: boolean;
};

export const sendModuleFactory = ({ stub = false }: FactoryProps) =>
  new ContainerModule(({ bind, rebindSync }) => {
    bind(sendTypes.SendApduUseCase).to(SendApduUseCase);
    bind(sendTypes.ExchangeBulkApdusUseCase).to(ExchangeBulkApdusUseCase);
    if (stub) {
      rebindSync(sendTypes.SendApduUseCase).to(StubUseCase);
      rebindSync(sendTypes.ExchangeBulkApdusUseCase).to(StubUseCase);
    }
  });
