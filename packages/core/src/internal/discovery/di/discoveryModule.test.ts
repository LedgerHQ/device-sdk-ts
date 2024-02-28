import { Container } from "inversify";

import { deviceModelModuleFactory } from "@internal/device-model/di/deviceModelModule";
import { ConnectUseCase } from "@internal/discovery/use-case/ConnectUseCase";
import { StartDiscoveringUseCase } from "@internal/discovery/use-case/StartDiscoveringUseCase";
import { StopDiscoveringUseCase } from "@internal/discovery/use-case/StopDiscoveringUseCase";
import { loggerModuleFactory } from "@internal/logger-publisher/di/loggerModule";
import { usbModuleFactory } from "@internal/usb/di/usbModule";

import { discoveryModuleFactory } from "./discoveryModule";
import { discoveryTypes } from "./discoveryTypes";

describe("discoveryModuleFactory", () => {
  let container: Container;
  let mod: ReturnType<typeof discoveryModuleFactory>;
  beforeEach(() => {
    mod = discoveryModuleFactory();
    container = new Container();
    container.load(
      mod,
      // The following modules are injected into discovery module
      loggerModuleFactory(),
      usbModuleFactory(),
      deviceModelModuleFactory(),
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

    const connectUseCase = container.get(discoveryTypes.ConnectUseCase);
    expect(connectUseCase).toBeInstanceOf(ConnectUseCase);
  });
});
