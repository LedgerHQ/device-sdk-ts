import { Container } from "inversify";

import { type DmkConfig } from "@api/DmkConfig";
import { TransportMock } from "@api/transport/model/__mocks__/TransportMock";
import { deviceModelModuleFactory } from "@internal/device-model/di/deviceModelModule";
import { deviceSessionModuleFactory } from "@internal/device-session/di/deviceSessionModule";
import { loggerModuleFactory } from "@internal/logger-publisher/di/loggerModule";

import { transportDiTypes } from "./transportDiTypes";
import { transportModuleFactory } from "./transportModule";

describe("transportModuleFactory", () => {
  describe("Default", () => {
    let container: Container;
    let mod: ReturnType<typeof transportModuleFactory>;
    beforeEach(() => {
      mod = transportModuleFactory();
      container = new Container();
      container.loadSync(mod);
    });

    it("should create the transport module", () => {
      expect(mod).toBeDefined();
    });

    it("should not bind the TransportService when transports is empty", () => {
      try {
        container.get(transportDiTypes.TransportService);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("With transports", () => {
    let container: Container;
    let mod: ReturnType<typeof transportModuleFactory>;
    let transport: TransportMock;
    beforeEach(() => {
      transport = new TransportMock();
      vi.spyOn(transport, "getIdentifier").mockReturnValue("MOCK");
      const logger = loggerModuleFactory();
      const deviceModel = deviceModelModuleFactory({ stub: true });
      const deviceSession = deviceSessionModuleFactory({ stub: true });
      mod = transportModuleFactory({
        transports: [() => transport],
        config: {
          managerApiUrl: "http://fake.url/api",
          mockUrl: "http://fake.url",
          webSocketUrl: "ws://fake.websocket.url",
          firmwareDistributionSalt: "salt",
        } as DmkConfig,
      });
      container = new Container();
      container.loadSync(logger, deviceModel, deviceSession, mod);
    });

    it("should bind the TransportService", () => {
      expect(container.get(transportDiTypes.TransportService)).toBeDefined();
    });
  });

  describe("With stub", () => {
    let container: Container;
    let mod: ReturnType<typeof transportModuleFactory>;
    let transport: TransportMock;
    beforeEach(() => {
      transport = new TransportMock();
      vi.spyOn(transport, "getIdentifier").mockReturnValue("MOCK");
      mod = transportModuleFactory({
        stub: true,
        transports: [() => transport],
      });
      container = new Container();
      container.loadSync(mod);
    });

    it("should create the transport module", () => {
      expect(mod).toBeDefined();
    });
  });
});
