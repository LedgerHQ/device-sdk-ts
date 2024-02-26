import { inject, injectable } from "inversify";

import { DeviceId } from "@internal/device-model/model/DeviceModel";
import { usbDiTypes } from "@internal/usb/di/usbDiTypes";
import { ConnectedDevice } from "@internal/usb/model/ConnectedDevice";
import type { UsbHidTransport } from "@internal/usb/transport/UsbHidTransport";

export type ConnectUseCaseArgs = {
  deviceId: DeviceId;
};

/**
 * Connects to a discovered device via USB HID (and later BLE).
 */
@injectable()
export class ConnectUseCase {
  constructor(
    @inject(usbDiTypes.UsbHidTransport)
    private usbHidTransport: UsbHidTransport,
    // Later: @inject(usbDiTypes.BleTransport) private bleTransport: BleTransport,
  ) {}

  async execute({ deviceId }: ConnectUseCaseArgs): Promise<ConnectedDevice> {
    const either = await this.usbHidTransport.connect({ deviceId });
    return either.caseOf({
      Left: (error) => {
        throw error;
      },
      Right: (connectedDevice) => connectedDevice,
    });
  }
}
