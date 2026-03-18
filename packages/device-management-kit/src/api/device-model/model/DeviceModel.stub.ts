import { DeviceModelId } from "@api/device/DeviceModel";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";

const KB = 1024;
const STUB_MEMORY_SIZE_MB = 2;
const STUB_MEMORY_SIZE = STUB_MEMORY_SIZE_MB * KB * KB;
const STUB_BLOCK_SIZE_KB = 4;
const STUB_BLOCK_SIZE = STUB_BLOCK_SIZE_KB * KB;
const STUB_MASK = 0x33000000;

export function deviceModelStubBuilder(
  props: Partial<TransportDeviceModel> = {},
): TransportDeviceModel {
  return {
    id: DeviceModelId.NANO_X,
    productName: "Ledger Nano X",
    usbProductId: 0x40,
    bootloaderUsbProductId: 0x0004,
    usbOnly: false,
    memorySize: STUB_MEMORY_SIZE,
    getBlockSize: () => STUB_BLOCK_SIZE,
    masks: [STUB_MASK],
    bluetoothSpec: [
      {
        serviceUuid: "13d63400-2c97-0004-0000-4c6564676572",
        notifyUuid: "13d63400-2c97-0004-0001-4c6564676572",
        writeUuid: "13d63400-2c97-0004-0002-4c6564676572",
        writeCmdUuid: "13d63400-2c97-0004-0003-4c6564676572",
      },
    ],
    ...props,
  };
}
