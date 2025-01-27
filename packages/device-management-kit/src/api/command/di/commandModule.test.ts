import { Container } from "inversify";

import { SendCommandUseCase } from "@api/command/use-case/SendCommandUseCase";
import { deviceSessionModuleFactory } from "@internal/device-session/di/deviceSessionModule";
import { loggerModuleFactory } from "@internal/logger-publisher/di/loggerModule";
import { StubUseCase } from "@root/src/di.stub";

import { commandModuleFactory } from "./commandModule";
import { commandTypes } from "./commandTypes";

describe("commandModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof commandModuleFactory>;
    beforeEach(() => {
      mod = commandModuleFactory();
      container = new Container();
      container.load(mod, deviceSessionModuleFactory(), loggerModuleFactory());
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return non-stubbed sendCommand usecase", () => {
      const sendCommandUseCase = container.get<SendCommandUseCase>(
        commandTypes.SendCommandUseCase,
      );
      expect(sendCommandUseCase).toBeInstanceOf(SendCommandUseCase);
    });
  });

  describe("Stubbed", () => {
    let container: Container;
    let mod: ReturnType<typeof commandModuleFactory>;
    beforeEach(() => {
      mod = commandModuleFactory({ stub: true });
      container = new Container();
      container.load(mod);
    });

    it("should return the config module", () => {
      expect(mod).toBeDefined();
    });

    it("should return stubbed sendCommand usecase", () => {
      const sendCommandUseCase = container.get(commandTypes.SendCommandUseCase);
      expect(sendCommandUseCase).toBeInstanceOf(StubUseCase);
    });
  });
});
