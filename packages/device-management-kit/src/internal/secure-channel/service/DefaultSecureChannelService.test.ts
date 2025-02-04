import { type Mocked } from "vitest";

import { getOsVersionCommandResponseMockBuilder } from "@api/command/os/__mocks__/GetOsVersionCommand";
import { type DmkConfig } from "@api/DmkConfig";
import { DeviceModelId } from "@api/index";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";

import { DefaultSecureChannelService } from "./DefaultSecureChannelService";
import { type SecureChannelService } from "./SecureChannelService";

vi.mock("@internal/secure-channel/data/DefaultSecureChannelDataSource");

let dataSource: Mocked<DefaultSecureChannelDataSource>;
let service: SecureChannelService;

describe("SecureChannelService", () => {
  beforeEach(() => {
    dataSource = new DefaultSecureChannelDataSource(
      {} as DmkConfig,
    ) as Mocked<DefaultSecureChannelDataSource>;

    service = new DefaultSecureChannelService(dataSource);
  });

  describe("genuineCheck service", () => {
    it("should call genuineCheck data source with passing parameters", () => {
      // given
      const deviceInfo = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.NANO_SP,
      );
      const finalFirmware = {
        perso: "perso",
      } as FinalFirmware;

      // when
      service.genuineCheck(deviceInfo, finalFirmware);

      // then
      expect(dataSource.genuineCheck).toHaveBeenCalledWith({
        targetId: deviceInfo.targetId.toString(),
        perso: "perso",
      });
    });
  });

  describe("listInstalledApps service", () => {
    it("should call listInstalledApps data source with passing parameters", () => {
      // given
      const deviceInfo = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.NANO_SP,
      );

      const finalFirmware = {
        perso: "perso",
      } as FinalFirmware;

      // when
      service.listInstalledApps(deviceInfo, finalFirmware);

      // then
      expect(dataSource.listInstalledApps).toHaveBeenCalledWith({
        targetId: deviceInfo.targetId.toString(),
        perso: "perso",
      });
    });
  });

  describe("updateMcu service", () => {
    it("should call updateMcu data source with passing parameters", () => {
      // given
      const deviceInfo = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.NANO_SP,
      );
      const version = "version";

      // when
      service.updateMcu(deviceInfo, { version });

      // then
      expect(dataSource.updateMcu).toHaveBeenCalledWith({
        targetId: deviceInfo.targetId.toString(),
        version,
      });
    });
  });

  describe("updateFirmware service", () => {
    it("should call updateFirmware data source with passing parameters", () => {
      // given
      const deviceInfo = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.NANO_SP,
      );

      const finalFirmware = {
        perso: "perso",
        firmware: "firmware",
        firmwareKey: "firmwareKey",
      } as FinalFirmware;

      // when
      service.updateFirmware(deviceInfo, finalFirmware);

      // then
      expect(dataSource.updateFirmware).toHaveBeenCalledWith({
        targetId: deviceInfo.targetId.toString(),
        perso: "perso",
        firmware: "firmware",
        firmwareKey: "firmwareKey",
      });
    });
  });

  describe("installApp service", () => {
    it("should call installApp data source with passing parameters", () => {
      // given
      const deviceInfo = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.NANO_SP,
      );
      const perso = "perso";
      const firmware = "firmware";
      const firmwareKey = "firmwareKey";
      const deleteKey = "deleteKey";
      const hash = "hash";

      // when
      service.installApp(
        deviceInfo,
        perso,
        firmware,
        firmwareKey,
        deleteKey,
        hash,
      );

      // then
      expect(dataSource.installApp).toHaveBeenCalledWith({
        targetId: deviceInfo.targetId.toString(),
        perso,
        firmware,
        firmwareKey,
        deleteKey,
        hash,
      });
    });
  });

  describe("uninstallApp service", () => {
    it("should call uninstallApp data source with passing parameters", () => {
      // given
      const deviceInfo = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.NANO_SP,
      );
      const perso = "perso";
      const firmware = "firmware";
      const firmwareKey = "firmwareKey";
      const deleteKey = "deleteKey";
      const hash = "hash";

      // when
      service.uninstallApp(
        deviceInfo,
        perso,
        firmware,
        firmwareKey,
        deleteKey,
        hash,
      );

      // then
      expect(dataSource.uninstallApp).toHaveBeenCalledWith({
        targetId: deviceInfo.targetId.toString(),
        perso,
        firmware,
        firmwareKey,
        deleteKey,
        hash,
      });
    });
  });
});
