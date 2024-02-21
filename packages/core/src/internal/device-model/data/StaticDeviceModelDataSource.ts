import { injectable } from "inversify";

import {
  DeviceModel,
  DeviceModelId,
} from "@internal/device-model/model/DeviceModel";

import { DeviceModelDataSource } from "./DeviceModelDataSource";

/**
 * Static/in memory implementation of the device model data source
 */
@injectable()
export class StaticDeviceModelDataSource implements DeviceModelDataSource {
  private static deviceModelByIds: { [key in DeviceModelId]: DeviceModel } = {
    [DeviceModelId.NANO_S]: new DeviceModel({
      id: DeviceModelId.NANO_S,
      productName: "Ledger Nano S",
      usbProductId: 0x10,
      legacyUsbProductId: 0x0001,
      usbOnly: true,
      memorySize: 320 * 1024,
      masks: [0x31100000],
    }),
    [DeviceModelId.NANO_SP]: new DeviceModel({
      id: DeviceModelId.NANO_SP,
      productName: "Ledger Nano S Plus",
      usbProductId: 0x50,
      legacyUsbProductId: 0x0005,
      usbOnly: true,
      memorySize: 1533 * 1024,
      masks: [0x33100000],
    }),
    [DeviceModelId.NANO_X]: new DeviceModel({
      id: DeviceModelId.NANO_X,
      productName: "Ledger Nano X",
      usbProductId: 0x40,
      legacyUsbProductId: 0x0004,
      usbOnly: false,
      memorySize: 2 * 1024 * 1024,
      masks: [0x33000000],
      bluetoothSpec: [
        {
          serviceUuid: "13d63400-2c97-0004-0000-4c6564676572",
          notifyUuid: "13d63400-2c97-0004-0001-4c6564676572",
          writeUuid: "13d63400-2c97-0004-0002-4c6564676572",
          writeCmdUuid: "13d63400-2c97-0004-0003-4c6564676572",
        },
      ],
    }),
    [DeviceModelId.STAX]: new DeviceModel({
      id: DeviceModelId.STAX,
      productName: "Ledger Stax",
      usbProductId: 0x60,
      legacyUsbProductId: 0x0006,
      usbOnly: false,
      memorySize: 1533 * 1024,
      masks: [0x33200000],
      bluetoothSpec: [
        {
          serviceUuid: "13d63400-2c97-6004-0000-4c6564676572",
          notifyUuid: "13d63400-2c97-6004-0001-4c6564676572",
          writeUuid: "13d63400-2c97-6004-0002-4c6564676572",
          writeCmdUuid: "13d63400-2c97-6004-0003-4c6564676572",
        },
      ],
    }),
  };

  getAllDeviceModels(): DeviceModel[] {
    return Object.values(StaticDeviceModelDataSource.deviceModelByIds);
  }

  getDeviceModel(params: { id: DeviceModelId }): DeviceModel {
    return StaticDeviceModelDataSource.deviceModelByIds[params.id];
  }

  /**
   * Returns the list of device models that match all the given parameters
   */
  filterDeviceModels(params: Partial<DeviceModel>): DeviceModel[] {
    return this.getAllDeviceModels().filter((deviceModel) => {
      return Object.entries(params).every(([key, value]) => {
        return deviceModel[key as keyof DeviceModel] === value;
      });
    });
  }
}
