import { type ServiceIdentifier } from "inversify";

import { type LocalConfigDataSource } from "@internal/config/data/ConfigDataSource";
import { StubLocalConfigDataSource } from "@internal/config/data/LocalConfigDataSource.stub";
import { configTypes } from "@internal/config/di/configTypes";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { discoveryTypes } from "@internal/discovery/di/discoveryTypes";
import { managerApiTypes } from "@internal/manager-api/di/managerApiTypes";
import { sendTypes } from "@internal/send/di/sendTypes";
import pkg from "@root/package.json";
import { StubUseCase } from "@root/src/di.stub";

import { commandTypes } from "./command/di/commandTypes";
import { ConsoleLogger } from "./logger-subscriber/service/ConsoleLogger";
import { DeviceManagementKit } from "./DeviceManagementKit";
import { type DmkConfig } from "./DmkConfig";

vi.mock("./logger-subscriber/service/ConsoleLogger");

let dmk: DeviceManagementKit;
let logger: ConsoleLogger;
describe("DeviceManagementKit", () => {
  describe("clean", () => {
    beforeEach(() => {
      logger = new ConsoleLogger();
      dmk = new DeviceManagementKit({
        stub: false,
        loggers: [logger],
        config: {
          managerApiUrl: "http://fake.url",
          mockUrl: "http://fake-mock.url",
          webSocketUrl: "http://fake-websocket.url",
          firmwareDistributionSalt: "salt",
        } as DmkConfig,
      });
    });

    it("should create an instance", () => {
      expect(dmk).toBeDefined();
      expect(dmk).toBeInstanceOf(DeviceManagementKit);
    });

    it("should return a clean `version`", async () => {
      expect(await dmk.getVersion()).toBe(pkg.version);
    });

    it("should have startDiscovery method", () => {
      expect(dmk.startDiscovering).toBeDefined();
    });

    it("should have stopDiscovery method", () => {
      expect(dmk.stopDiscovering).toBeDefined();
    });

    it("should have connect method", () => {
      expect(dmk.connect).toBeDefined();
    });

    it("should have sendApdu method", () => {
      expect(dmk.sendApdu).toBeDefined();
    });

    it("should have getConnectedDevice method", () => {
      expect(dmk.getConnectedDevice).toBeDefined();
    });

    it("should have sendCommand method", () => {
      expect(dmk.sendCommand).toBeDefined();
    });

    it("should have listConnectedDevices method", () => {
      expect(dmk.listConnectedDevices).toBeDefined();
    });

    it("should have listenToConnectedDevice method", () => {
      expect(dmk.listenToConnectedDevice).toBeDefined();
    });

    it("should have disableDeviceSessionRefresher method", () => {
      expect(dmk.disableDeviceSessionRefresher).toBeDefined();
    });

    it("should have setProvider method", () => {
      expect(dmk.setProvider).toBeDefined();
    });
  });

  describe("stubbed", () => {
    beforeEach(() => {
      dmk = new DeviceManagementKit({
        stub: true,
        loggers: [],
        config: {
          managerApiUrl: "http://fake.url",
          mockUrl: "http://fake-mock.url",
          webSocketUrl: "http://fake-websocket.url",
          firmwareDistributionSalt: "salt",
        } as DmkConfig,
      });
    });

    it("should create a stubbed dmk", () => {
      expect(dmk).toBeDefined();
      expect(dmk).toBeInstanceOf(DeviceManagementKit);
    });

    it("should return a stubbed config", () => {
      expect(
        dmk.container.get<LocalConfigDataSource>(
          configTypes.LocalConfigDataSource,
        ),
      ).toBeInstanceOf(StubLocalConfigDataSource);
    });

    it("should return a stubbed version", async () => {
      expect(await dmk.getVersion()).toBe("0.0.0-stub.1");
    });

    it.each([
      [discoveryTypes.StartDiscoveringUseCase],
      [discoveryTypes.StopDiscoveringUseCase],
      [discoveryTypes.ConnectUseCase],
      [sendTypes.SendApduUseCase],
      [commandTypes.SendCommandUseCase],
      [discoveryTypes.GetConnectedDeviceUseCase],
      [discoveryTypes.DisconnectUseCase],
      [deviceSessionTypes.GetDeviceSessionStateUseCase],
      [discoveryTypes.ListConnectedDevicesUseCase],
      [discoveryTypes.ListenToConnectedDeviceUseCase],
      [managerApiTypes.SetProviderUseCase],
    ])(
      "should have %s use case",
      (diSymbol: ServiceIdentifier<StubUseCase>) => {
        const uc = dmk.container.get<StubUseCase>(diSymbol);
        expect(uc).toBeInstanceOf(StubUseCase);
        expect(uc.execute()).toBe("stub");
      },
    );
  });
});
