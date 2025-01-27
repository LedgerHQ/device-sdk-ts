import { Container } from "inversify";

import { ExecuteDeviceActionUseCase } from "@api/device-action/use-case/ExecuteDeviceActionUseCase";
import { deviceSessionModuleFactory } from "@internal/device-session/di/deviceSessionModule";
import { loggerModuleFactory } from "@internal/logger-publisher/di/loggerModule";
import { StubUseCase } from "@root/src/di.stub";

import { deviceActionModuleFactory } from "./deviceActionModule";
import { deviceActionTypes } from "./deviceActionTypes";

describe("deviceActionModule", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof deviceActionModuleFactory>;
    beforeEach(() => {
      mod = deviceActionModuleFactory();
      container = new Container();
      container.load(mod, deviceSessionModuleFactory(), loggerModuleFactory());
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return non-stubbed executeDeviceAction usecase", () => {
      const executeDeviceActionUseCase =
        container.get<ExecuteDeviceActionUseCase>(
          deviceActionTypes.ExecuteDeviceActionUseCase,
        );
      expect(executeDeviceActionUseCase).toBeInstanceOf(
        ExecuteDeviceActionUseCase,
      );
    });
  });

  describe("Stubbed", () => {
    let container: Container;
    let mod: ReturnType<typeof deviceActionModuleFactory>;
    beforeEach(() => {
      mod = deviceActionModuleFactory({ stub: true });
      container = new Container();
      container.load(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return stubbed executeDeviceAction usecase", () => {
      const executeDeviceActionUseCase = container.get(
        deviceActionTypes.ExecuteDeviceActionUseCase,
      );
      expect(executeDeviceActionUseCase).toBeInstanceOf(StubUseCase);
    });
  });
});
