import { type DeviceModelId } from "@api/device/DeviceModel";

type DeviceModel = {
  /** Identifier of the device model */
  id: DeviceModelId;

  /** Displayed name of the device model */
  productName: string;

  /** USB product ID of the device model */
  usbProductId: number;

  /** USB product ID of the device model, in bootloader mode */
  bootloaderUsbProductId: number;

  /** Whether the device model is only USB-based */
  usbOnly: boolean;

  /** Memory size of the device model, in bytes */
  memorySize: number;

  /**
   * Function to get the block size of the device model, in bytes
   * Blocks are the smallest units of memory that can be written to the device.
   * The block size can be different for different firmware versions.
   */
  getBlockSize: (p: { firmwareVersion: string }) => number;

  /**
   * When applying 0xffff0000 to a device target id (obtained from the getOSVersion command),
   * the result will be one of the masks for the device model.
   */
  masks: number[];

  /**
   * Bluetooth specifications for the device model.
   * Only available for devices that support Bluetooth.
   */
  bluetoothSpec?: {
    serviceUuid: string;
    writeUuid: string;
    writeCmdUuid: string;
    notifyUuid: string;
  }[];
};

/**
 * The info of a device model
 */
export class TransportDeviceModel implements DeviceModel {
  id: DeviceModelId;
  productName: string;
  usbProductId: number;
  bootloaderUsbProductId: number;
  usbOnly: boolean;
  memorySize: number;
  getBlockSize: (p: { firmwareVersion: string }) => number;
  masks: number[];
  bluetoothSpec?: {
    serviceUuid: string;
    writeUuid: string;
    writeCmdUuid: string;
    notifyUuid: string;
  }[];

  constructor(props: DeviceModel) {
    this.id = props.id;
    this.productName = props.productName;
    this.usbProductId = props.usbProductId;
    this.bootloaderUsbProductId = props.bootloaderUsbProductId;
    this.usbOnly = props.usbOnly;
    this.memorySize = props.memorySize;
    this.getBlockSize = props.getBlockSize;
    this.masks = props.masks;
    this.bluetoothSpec = props.bluetoothSpec;
  }
}
