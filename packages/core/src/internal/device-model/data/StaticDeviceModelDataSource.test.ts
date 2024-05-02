import { DeviceModelId } from "@api/device/DeviceModel";

import { StaticDeviceModelDataSource } from "./StaticDeviceModelDataSource";

describe("StaticDeviceModelDataSource", () => {
  describe("getAllDeviceModels", () => {
    it("should return all device models", () => {
      const dataSource = new StaticDeviceModelDataSource();
      const deviceModels = dataSource.getAllDeviceModels();

      // Currently supporting 4 device models
      expect(deviceModels.length).toEqual(4);
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
});
