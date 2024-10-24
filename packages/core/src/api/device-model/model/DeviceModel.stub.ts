import { DeviceModelId } from "@api/device/DeviceModel";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";

export function deviceModelStubBuilder(
  props: Partial<TransportDeviceModel> = {},
): TransportDeviceModel {
  return {
    id: DeviceModelId.NANO_X,
    productName: "Ledger Nano X",
    usbProductId: 0x40,
    bootloaderUsbProductId: 0x0004,
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
    getBlockSize: () => 4 * 1024,
    ...props,
  };
}
