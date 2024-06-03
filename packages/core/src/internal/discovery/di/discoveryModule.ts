import { ContainerModule } from "inversify";

import { ConnectUseCase } from "@internal/discovery/use-case/ConnectUseCase";
import { DisconnectUseCase } from "@internal/discovery/use-case/DisconnectUseCase";
import { GetConnectedDeviceUseCase } from "@internal/discovery/use-case/GetConnectedDeviceUseCase";
import { StartDiscoveringUseCase } from "@internal/discovery/use-case/StartDiscoveringUseCase";
import { StopDiscoveringUseCase } from "@internal/discovery/use-case/StopDiscoveringUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { discoveryTypes } from "./discoveryTypes";

type FactoryProps = {
  stub: boolean;
};

export const discoveryModuleFactory = ({ stub = false }: FactoryProps) =>
  new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(discoveryTypes.ConnectUseCase).to(ConnectUseCase);
    bind(discoveryTypes.DisconnectUseCase).to(DisconnectUseCase);
    bind(discoveryTypes.StartDiscoveringUseCase).to(StartDiscoveringUseCase);
    bind(discoveryTypes.StopDiscoveringUseCase).to(StopDiscoveringUseCase);
    bind(discoveryTypes.GetConnectedDeviceUseCase).to(
      GetConnectedDeviceUseCase,
    );

    if (stub) {
      rebind(discoveryTypes.StartDiscoveringUseCase).to(StubUseCase);
      rebind(discoveryTypes.StopDiscoveringUseCase).to(StubUseCase);
      rebind(discoveryTypes.ConnectUseCase).to(StubUseCase);
      rebind(discoveryTypes.DisconnectUseCase).to(StubUseCase);
      rebind(discoveryTypes.GetConnectedDeviceUseCase).to(StubUseCase);
    }
  });
