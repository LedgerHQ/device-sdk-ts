import semver from "semver";

import { DeviceModelId } from "@api/device/DeviceModel";

/**
 * The info of a device model
 */
export class TransportDeviceModel {
  id: DeviceModelId;
  productName: string;
  usbProductId: number;
  bootloaderUsbProductId: number;
  usbOnly: boolean;
  memorySize: number;
  masks: number[];
  bluetoothSpec?: {
    serviceUuid: string;
    writeUuid: string;
    writeCmdUuid: string;
    notifyUuid: string;
  }[];

  constructor(props: {
    id: DeviceModelId;
    productName: string;
    usbProductId: number;
    bootloaderUsbProductId: number;
    usbOnly: boolean;
    memorySize: number;
    masks: number[];

    bluetoothSpec?: {
      serviceUuid: string;
      writeUuid: string;
      writeCmdUuid: string;
      notifyUuid: string;
    }[];
  }) {
    this.id = props.id;
    this.productName = props.productName;
    this.usbProductId = props.usbProductId;
    this.bootloaderUsbProductId = props.bootloaderUsbProductId;
    this.usbOnly = props.usbOnly;
    this.memorySize = props.memorySize;
    this.masks = props.masks;
    this.bluetoothSpec = props.bluetoothSpec;
  }

  getBlockSize(firmwareVersion: string): number {
    switch (this.id) {
      case DeviceModelId.NANO_S:
        return semver.lt(semver.coerce(firmwareVersion) ?? "", "2.0.0")
          ? 4 * 1024
          : 2 * 1024;
      case DeviceModelId.NANO_X:
        return 4 * 1024;
      case DeviceModelId.NANO_SP:
      case DeviceModelId.STAX:
      case DeviceModelId.FLEX:
        return 32;
    }
  }
}
