import { ContainerModule } from "inversify";

import { ConnectUseCase } from "@internal/discovery/use-case/ConnectUseCase";
import { StartDiscoveringUseCase } from "@internal/discovery/use-case/StartDiscoveringUseCase";
import { StopDiscoveringUseCase } from "@internal/discovery/use-case/StopDiscoveringUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { discoveryTypes } from "./discoveryTypes";

type FactoryProps = {
  stub: boolean;
};

export const discoveryModuleFactory = ({
  stub = false,
}: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(discoveryTypes.StartDiscoveringUseCase).to(StartDiscoveringUseCase);
    bind(discoveryTypes.StopDiscoveringUseCase).to(StopDiscoveringUseCase);
    bind(discoveryTypes.ConnectUseCase).to(ConnectUseCase);

    if (stub) {
      rebind(discoveryTypes.StartDiscoveringUseCase).to(StubUseCase);
      rebind(discoveryTypes.StopDiscoveringUseCase).to(StubUseCase);
      rebind(discoveryTypes.ConnectUseCase).to(StubUseCase);
    }
  });
