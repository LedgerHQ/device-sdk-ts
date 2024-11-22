import { DeviceModelId } from "@api/device/DeviceModel";
import { BleDeviceInfos } from "@api/device-model/model/BleDeviceInfos";

import { StaticDeviceModelDataSource } from "./StaticDeviceModelDataSource";

describe("StaticDeviceModelDataSource", () => {
  describe("getAllDeviceModels", () => {
    it("should return all device models", () => {
      const dataSource = new StaticDeviceModelDataSource();
      const deviceModels = dataSource.getAllDeviceModels();

      // Currently supporting 4 device models
      expect(deviceModels.length).toEqual(5);
      expect(deviceModels).toContainEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_S }),
      );
      expect(deviceModels).toContainEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_SP }),
      );
      expect(deviceModels).toContainEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_X }),
      );
      expect(deviceModels).toContainEqual(
        expect.objectContaining({ id: DeviceModelId.STAX }),
      );
      expect(deviceModels).toContainEqual(
        expect.objectContaining({ id: DeviceModelId.FLEX }),
      );
    });
  });

  describe("getDeviceModel", () => {
    it("should return the associated device model", () => {
      const dataSource = new StaticDeviceModelDataSource();

      const deviceModel1 = dataSource.getDeviceModel({
        id: DeviceModelId.NANO_S,
      });
      expect(deviceModel1).toEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_S }),
      );

      const deviceModel2 = dataSource.getDeviceModel({
        id: DeviceModelId.NANO_SP,
      });
      expect(deviceModel2).toEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_SP }),
      );

      const deviceModel3 = dataSource.getDeviceModel({
        id: DeviceModelId.NANO_X,
      });
      expect(deviceModel3).toEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_X }),
      );

      const deviceModel4 = dataSource.getDeviceModel({
        id: DeviceModelId.STAX,
      });
      expect(deviceModel4).toEqual(
        expect.objectContaining({ id: DeviceModelId.STAX }),
      );

      const deviceModel5 = dataSource.getDeviceModel({
        id: DeviceModelId.FLEX,
      });
      expect(deviceModel5).toEqual(
        expect.objectContaining({ id: DeviceModelId.FLEX }),
      );
    });
  });

  describe("filterDeviceModels", () => {
    it("should return the device models that match the given single parameter", () => {
      const dataSource = new StaticDeviceModelDataSource();

      const deviceModels1 = dataSource.filterDeviceModels({ usbOnly: true });
      expect(deviceModels1.length).toEqual(2);
      expect(deviceModels1).toContainEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_SP }),
      );
      expect(deviceModels1).toContainEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_S }),
      );

      const deviceModels2 = dataSource.filterDeviceModels({
        usbProductId: 0x10,
      });
      expect(deviceModels2.length).toEqual(1);
      expect(deviceModels2[0]).toEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_S }),
      );

      const deviceModels3 = dataSource.filterDeviceModels({
        usbProductId: 0x40,
      });
      expect(deviceModels3.length).toEqual(1);
      expect(deviceModels3[0]).toEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_X }),
      );

      const deviceModels4 = dataSource.filterDeviceModels({
        usbProductId: 0x50,
      });
      expect(deviceModels4.length).toEqual(1);
      expect(deviceModels4[0]).toEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_SP }),
      );

      const deviceModels5 = dataSource.filterDeviceModels({
        usbProductId: 0x60,
      });
      expect(deviceModels5.length).toEqual(1);
      expect(deviceModels5[0]).toEqual(
        expect.objectContaining({ id: DeviceModelId.STAX }),
      );

      const deviceModels6 = dataSource.filterDeviceModels({
        usbProductId: 0x00,
      });
      expect(deviceModels6.length).toEqual(0);
    });

    it("should return the device models that match the given multiple parameters", () => {
      const dataSource = new StaticDeviceModelDataSource();

      const deviceModels1 = dataSource.filterDeviceModels({
        usbOnly: false,
        usbProductId: 0x40,
      });
      expect(deviceModels1.length).toEqual(1);
      expect(deviceModels1[0]).toEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_X }),
      );

      const deviceModels2 = dataSource.filterDeviceModels({
        usbOnly: true,
        usbProductId: 0x50,
      });
      expect(deviceModels2.length).toEqual(1);
      expect(deviceModels2[0]).toEqual(
        expect.objectContaining({ id: DeviceModelId.NANO_SP }),
      );

      // Nano S is usbOnly
      const deviceModels3 = dataSource.filterDeviceModels({
        usbOnly: false,
        usbProductId: 0x10,
      });
      expect(deviceModels3.length).toEqual(0);
    });
  });
  describe("getBluetoothServicesInfos", () => {
    it("should return the ble service infos record", () => {
      // given
      const dataSource = new StaticDeviceModelDataSource();
      // when
      const bleServiceInfos = dataSource.getBluetoothServicesInfos();
      // then
      expect(bleServiceInfos).toStrictEqual({
        "13d63400-2c97-0004-0000-4c6564676572": new BleDeviceInfos(
          dataSource.getDeviceModel({ id: DeviceModelId.NANO_X }),
          "13d63400-2c97-0004-0000-4c6564676572",
          "13d63400-2c97-0004-0002-4c6564676572",
          "13d63400-2c97-0004-0003-4c6564676572",
          "13d63400-2c97-0004-0001-4c6564676572",
        ),
        "13d63400-2c97-6004-0000-4c6564676572": new BleDeviceInfos(
          dataSource.getDeviceModel({ id: DeviceModelId.STAX }),
          "13d63400-2c97-6004-0000-4c6564676572",
          "13d63400-2c97-6004-0002-4c6564676572",
          "13d63400-2c97-6004-0003-4c6564676572",
          "13d63400-2c97-6004-0001-4c6564676572",
        ),
        "13d63400-2c97-3004-0000-4c6564676572": new BleDeviceInfos(
          dataSource.getDeviceModel({ id: DeviceModelId.FLEX }),
          "13d63400-2c97-3004-0000-4c6564676572",
          "13d63400-2c97-3004-0002-4c6564676572",
          "13d63400-2c97-3004-0003-4c6564676572",
          "13d63400-2c97-3004-0001-4c6564676572",
        ),
      });
    });
  });
  describe("getBluetoothServices", () => {
    it("should return the bluetooth services", () => {
      // given
      const dataSource = new StaticDeviceModelDataSource();
      // when
      const bleServices = dataSource.getBluetoothServices();
      // then
      expect(bleServices).toStrictEqual([
        "13d63400-2c97-0004-0000-4c6564676572",
        "13d63400-2c97-6004-0000-4c6564676572",
        "13d63400-2c97-3004-0000-4c6564676572",
      ]);
    });
  });
});
