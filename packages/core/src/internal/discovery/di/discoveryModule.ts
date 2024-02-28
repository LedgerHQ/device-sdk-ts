import { ContainerModule } from "inversify";

import { ConnectUseCase } from "@internal/discovery/use-case/ConnectUseCase";
import { StartDiscoveringUseCase } from "@internal/discovery/use-case/StartDiscoveringUseCase";
import { StopDiscoveringUseCase } from "@internal/discovery/use-case/StopDiscoveringUseCase";

import { discoveryTypes } from "./discoveryTypes";

type FactoryProps = {
  stub: boolean;
};

export const discoveryModuleFactory = ({
  stub = false,
}: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(discoveryTypes.StartDiscoveringUseCase).to(StartDiscoveringUseCase);
    bind(discoveryTypes.StopDiscoveringUseCase).to(StopDiscoveringUseCase);
    bind(discoveryTypes.ConnectUseCase).to(ConnectUseCase);

    if (stub) {
      // We can rebind our interfaces to their mock implementations
      // rebind(...).to(....);
    }
  });
