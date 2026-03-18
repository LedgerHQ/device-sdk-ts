import { injectable } from "inversify";
import semver from "semver";

import { DeviceModelId } from "@api/device/DeviceModel";
import { DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import { BleDeviceInfos } from "@api/device-model/model/BleDeviceInfos";
import { TransportDeviceModel } from "@api/device-model/model/DeviceModel";

const KB = 1024;
const NANO_S_MEMORY_SIZE_KB = 320;
const LARGE_DEVICE_MEMORY_SIZE_KB = 1533;
const NANO_X_MEMORY_SIZE_MB = 2;
const BLOCK_2K_MULTIPLIER = 2;
const BLOCK_4K_MULTIPLIER = 4;
const DEFAULT_BLOCK_SIZE = 32;

const NANO_S_MEMORY_SIZE = NANO_S_MEMORY_SIZE_KB * KB;
const NANO_S_BLOCK_SIZE_OLD_FW = BLOCK_4K_MULTIPLIER * KB;
const NANO_S_BLOCK_SIZE_NEW_FW = BLOCK_2K_MULTIPLIER * KB;
const NANO_S_MASK = 0x31100000;

const NANO_SP_MEMORY_SIZE = LARGE_DEVICE_MEMORY_SIZE_KB * KB;
const NANO_SP_MASK = 0x33100000;

const NANO_X_MEMORY_SIZE = NANO_X_MEMORY_SIZE_MB * KB * KB;
const NANO_X_BLOCK_SIZE = BLOCK_4K_MULTIPLIER * KB;
const NANO_X_MASK = 0x33000000;

const STAX_MEMORY_SIZE = LARGE_DEVICE_MEMORY_SIZE_KB * KB;
const STAX_MASK = 0x33200000;

const FLEX_MEMORY_SIZE = LARGE_DEVICE_MEMORY_SIZE_KB * KB;
const FLEX_MASK = 0x33300000;

const APEX_MEMORY_SIZE = LARGE_DEVICE_MEMORY_SIZE_KB * KB;
const APEX_MASK = 0x33400000;

/**
 * Static/in memory implementation of the device model data source
 */
@injectable()
export class StaticDeviceModelDataSource implements DeviceModelDataSource {
  private static deviceModelByIds: {
    [_key in DeviceModelId]: TransportDeviceModel;
  } = {
    [DeviceModelId.NANO_S]: new TransportDeviceModel({
      id: DeviceModelId.NANO_S,
      productName: "Ledger Nano S",
      usbProductId: 0x10,
      bootloaderUsbProductId: 0x0001,
      usbOnly: true,
      memorySize: NANO_S_MEMORY_SIZE,
      getBlockSize: (p: { firmwareVersion: string }) =>
        semver.lt(semver.coerce(p.firmwareVersion) ?? "", "2.0.0")
          ? NANO_S_BLOCK_SIZE_OLD_FW
          : NANO_S_BLOCK_SIZE_NEW_FW,
      masks: [NANO_S_MASK],
    }),
    [DeviceModelId.NANO_SP]: new TransportDeviceModel({
      id: DeviceModelId.NANO_SP,
      productName: "Ledger Nano S Plus",
      usbProductId: 0x50,
      bootloaderUsbProductId: 0x0005,
      usbOnly: true,
      memorySize: NANO_SP_MEMORY_SIZE,
      getBlockSize: () => DEFAULT_BLOCK_SIZE,
      masks: [NANO_SP_MASK],
    }),
    [DeviceModelId.NANO_X]: new TransportDeviceModel({
      id: DeviceModelId.NANO_X,
      productName: "Ledger Nano X",
      usbProductId: 0x40,
      bootloaderUsbProductId: 0x0004,
      usbOnly: false,
      memorySize: NANO_X_MEMORY_SIZE,
      getBlockSize: () => NANO_X_BLOCK_SIZE,
      masks: [NANO_X_MASK],
      bluetoothSpec: [
        {
          serviceUuid: "13d63400-2c97-0004-0000-4c6564676572",
          notifyUuid: "13d63400-2c97-0004-0001-4c6564676572",
          writeUuid: "13d63400-2c97-0004-0002-4c6564676572",
          writeCmdUuid: "13d63400-2c97-0004-0003-4c6564676572",
        },
      ],
    }),
    [DeviceModelId.STAX]: new TransportDeviceModel({
      id: DeviceModelId.STAX,
      productName: "Ledger Stax",
      usbProductId: 0x60,
      bootloaderUsbProductId: 0x0006,
      usbOnly: false,
      memorySize: STAX_MEMORY_SIZE,
      getBlockSize: () => DEFAULT_BLOCK_SIZE,
      masks: [STAX_MASK],
      bluetoothSpec: [
        {
          serviceUuid: "13d63400-2c97-6004-0000-4c6564676572",
          notifyUuid: "13d63400-2c97-6004-0001-4c6564676572",
          writeUuid: "13d63400-2c97-6004-0002-4c6564676572",
          writeCmdUuid: "13d63400-2c97-6004-0003-4c6564676572",
        },
      ],
    }),
    [DeviceModelId.FLEX]: new TransportDeviceModel({
      id: DeviceModelId.FLEX,
      productName: "Ledger Flex",
      usbProductId: 0x70,
      bootloaderUsbProductId: 0x0007,
      usbOnly: false,
      memorySize: FLEX_MEMORY_SIZE,
      getBlockSize: () => DEFAULT_BLOCK_SIZE,
      masks: [FLEX_MASK],
      bluetoothSpec: [
        {
          serviceUuid: "13d63400-2c97-3004-0000-4c6564676572",
          notifyUuid: "13d63400-2c97-3004-0001-4c6564676572",
          writeUuid: "13d63400-2c97-3004-0002-4c6564676572",
          writeCmdUuid: "13d63400-2c97-3004-0003-4c6564676572",
        },
      ],
    }),
    [DeviceModelId.APEX]: new TransportDeviceModel({
      id: DeviceModelId.APEX,
      productName: "Ledger Nano Gen5",
      usbProductId: 0x80,
      bootloaderUsbProductId: 0x0008,
      usbOnly: false,
      memorySize: APEX_MEMORY_SIZE,
      getBlockSize: () => DEFAULT_BLOCK_SIZE,
      masks: [APEX_MASK],
      bluetoothSpec: [
        {
          serviceUuid: "13d63400-2c97-8004-0000-4c6564676572",
          notifyUuid: "13d63400-2c97-8004-0001-4c6564676572",
          writeUuid: "13d63400-2c97-8004-0002-4c6564676572",
          writeCmdUuid: "13d63400-2c97-8004-0003-4c6564676572",
        },
        {
          serviceUuid: "13d63400-2c97-9004-0000-4c6564676572",
          notifyUuid: "13d63400-2c97-9004-0001-4c6564676572",
          writeUuid: "13d63400-2c97-9004-0002-4c6564676572",
          writeCmdUuid: "13d63400-2c97-9004-0003-4c6564676572",
        },
      ],
    }),
  };

  getAllDeviceModels(): TransportDeviceModel[] {
    return Object.values(StaticDeviceModelDataSource.deviceModelByIds);
  }

  getDeviceModel(params: { id: DeviceModelId }): TransportDeviceModel {
    return StaticDeviceModelDataSource.deviceModelByIds[params.id];
  }

  /**
   * Returns the list of device models that match all the given parameters
   */
  filterDeviceModels(
    params: Partial<TransportDeviceModel>,
  ): TransportDeviceModel[] {
    return this.getAllDeviceModels().filter((deviceModel) => {
      return Object.entries(params).every(([key, value]) => {
        return deviceModel[key as keyof TransportDeviceModel] === value;
      });
    });
  }

  /**
   * @returns A record of service UUIDs to BleDeviceInfos
   */
  getBluetoothServicesInfos(): Record<string, BleDeviceInfos> {
    return Object.values(StaticDeviceModelDataSource.deviceModelByIds).reduce<
      Record<string, BleDeviceInfos>
    >((acc, deviceModel) => {
      const { bluetoothSpec } = deviceModel;
      if (bluetoothSpec) {
        return {
          ...acc,
          ...bluetoothSpec.reduce<Record<string, BleDeviceInfos>>(
            (serviceToModel, bleSpec) => ({
              ...serviceToModel,
              [bleSpec.serviceUuid]: new BleDeviceInfos(
                deviceModel,
                bleSpec.serviceUuid,
                bleSpec.writeUuid,
                bleSpec.writeCmdUuid,
                bleSpec.notifyUuid,
              ),
            }),
            {},
          ),
        };
      }
      return acc;
    }, {});
  }

  getBluetoothServices(): string[] {
    return Object.values(StaticDeviceModelDataSource.deviceModelByIds)
      .map((deviceModel) =>
        (deviceModel.bluetoothSpec || []).map((spec) => spec.serviceUuid),
      )
      .flat()
      .filter((uuid) => !!uuid);
  }
}
