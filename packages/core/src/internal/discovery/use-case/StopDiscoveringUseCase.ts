import { inject, injectable } from "inversify";

import { usbDiTypes } from "@internal/usb/di/usbDiTypes";
import type { UsbHidTransport } from "@internal/usb/transport/UsbHidTransport";

/**
 * Stops discovering devices connected via USB HID (and later BLE).
 */
@injectable()
export class StopDiscoveringUseCase {
  constructor(
    @inject(usbDiTypes.UsbHidTransport)
    private usbHidTransport: UsbHidTransport,
    // Later: @inject(usbDiTypes.BleTransport) private bleTransport: BleTransport,
  ) {}

  execute(): void {
    return this.usbHidTransport.stopDiscovering();
  }
}
