import { ContainerModule } from "inversify";

import { ConnectUseCase } from "@internal/discovery/use-case/ConnectUseCase";
import { DisconnectUseCase } from "@internal/discovery/use-case/DisconnectUseCase";
import { GetConnectedDeviceUseCase } from "@internal/discovery/use-case/GetConnectedDeviceUseCase";
import { ListConnectedDevicesUseCase } from "@internal/discovery/use-case/ListConnectedDevicesUseCase";
import { ListenToAvailableDevicesUseCase } from "@internal/discovery/use-case/ListenToAvailableDevicesUseCase";
import { ListenToConnectedDeviceUseCase } from "@internal/discovery/use-case/ListenToConnectedDeviceUseCase";
import { StartDiscoveringUseCase } from "@internal/discovery/use-case/StartDiscoveringUseCase";
import { StopDiscoveringUseCase } from "@internal/discovery/use-case/StopDiscoveringUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { discoveryTypes } from "./discoveryTypes";

type FactoryProps = {
  stub: boolean;
};

export const discoveryModuleFactory = ({ stub = false }: FactoryProps) =>
  new ContainerModule(({ bind, rebindSync }) => {
    bind(discoveryTypes.ConnectUseCase).to(ConnectUseCase);
    bind(discoveryTypes.DisconnectUseCase).to(DisconnectUseCase);
    bind(discoveryTypes.StartDiscoveringUseCase).to(StartDiscoveringUseCase);
    bind(discoveryTypes.StopDiscoveringUseCase).to(StopDiscoveringUseCase);
    bind(discoveryTypes.GetConnectedDeviceUseCase).to(
      GetConnectedDeviceUseCase,
    );
    bind(discoveryTypes.ListenToAvailableDevicesUseCase).to(
      ListenToAvailableDevicesUseCase,
    );
    bind(discoveryTypes.ListenToConnectedDeviceUseCase).to(
      ListenToConnectedDeviceUseCase,
    );
    bind(discoveryTypes.ListConnectedDevicesUseCase).to(
      ListConnectedDevicesUseCase,
    );

    if (stub) {
      rebindSync(discoveryTypes.ConnectUseCase).to(StubUseCase);
      rebindSync(discoveryTypes.DisconnectUseCase).to(StubUseCase);
      rebindSync(discoveryTypes.StartDiscoveringUseCase).to(StubUseCase);
      rebindSync(discoveryTypes.StopDiscoveringUseCase).to(StubUseCase);
      rebindSync(discoveryTypes.GetConnectedDeviceUseCase).to(StubUseCase);
      rebindSync(discoveryTypes.ListenToAvailableDevicesUseCase).to(
        StubUseCase,
      );
      rebindSync(discoveryTypes.ListenToConnectedDeviceUseCase).to(StubUseCase);
      rebindSync(discoveryTypes.ListConnectedDevicesUseCase).to(StubUseCase);
    }
  });
