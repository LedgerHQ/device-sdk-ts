import { Container } from "inversify";

import { deviceModelModuleFactory } from "@internal/device-model/di/deviceModelModule";
import { deviceSessionModuleFactory } from "@internal/device-session/di/deviceSessionModule";
import { ConnectUseCase } from "@internal/discovery/use-case/ConnectUseCase";
import { DisconnectUseCase } from "@internal/discovery/use-case/DisconnectUseCase";
import { ListConnectedDevicesUseCase } from "@internal/discovery/use-case/ListConnectedDevicesUseCase";
import { ListenToKnownDevicesUseCase } from "@internal/discovery/use-case/ListenToKnownDevicesUseCase";
import { StartDiscoveringUseCase } from "@internal/discovery/use-case/StartDiscoveringUseCase";
import { StopDiscoveringUseCase } from "@internal/discovery/use-case/StopDiscoveringUseCase";
import { loggerModuleFactory } from "@internal/logger-publisher/di/loggerModule";
import { managerApiModuleFactory } from "@internal/manager-api/di/managerApiModule";
import { transportModuleFactory } from "@internal/transport/di/transportModule";

import { discoveryModuleFactory } from "./discoveryModule";
import { discoveryTypes } from "./discoveryTypes";

describe("discoveryModuleFactory", () => {
  let container: Container;
  let mod: ReturnType<typeof discoveryModuleFactory>;
  beforeEach(() => {
    mod = discoveryModuleFactory({ stub: false });
    container = new Container();
    container.load(
      mod,
      // The following modules are injected into discovery module
      loggerModuleFactory(),
      deviceModelModuleFactory({ stub: false }),
      deviceSessionModuleFactory(),
      transportModuleFactory({ transports: [] }),
      managerApiModuleFactory({
        config: {
          managerApiUrl: "http://fake.url",
          mockUrl: "http://fake-mock.url",
        },
      }),
    );
  });

  it("should return the device module", () => {
    expect(mod).toBeDefined();
  });

  it("should return none mocked use cases", () => {
    const startDiscoveringUseCase = container.get(
      discoveryTypes.StartDiscoveringUseCase,
    );
    expect(startDiscoveringUseCase).toBeInstanceOf(StartDiscoveringUseCase);

    const stopDiscoveringUseCase = container.get(
      discoveryTypes.StopDiscoveringUseCase,
    );
    expect(stopDiscoveringUseCase).toBeInstanceOf(StopDiscoveringUseCase);

    const disconnectUseCase = container.get(discoveryTypes.DisconnectUseCase);
    expect(disconnectUseCase).toBeInstanceOf(DisconnectUseCase);

    const connectUseCase = container.get(discoveryTypes.ConnectUseCase);
    expect(connectUseCase).toBeInstanceOf(ConnectUseCase);

    const listenToKnownDevicesUseCase = container.get(
      discoveryTypes.ListenToKnownDevicesUseCase,
    );
    expect(listenToKnownDevicesUseCase).toBeInstanceOf(
      ListenToKnownDevicesUseCase,
    );
    const listConnectedDevicesUseCase = container.get(
      discoveryTypes.ListConnectedDevicesUseCase,
    );
    expect(listConnectedDevicesUseCase).toBeInstanceOf(
      ListConnectedDevicesUseCase,
    );
  });
});
