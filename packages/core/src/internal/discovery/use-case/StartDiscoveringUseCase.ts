import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { usbDiTypes } from "@internal/usb/di/usbDiTypes";
import { DiscoveredDevice } from "@internal/usb/model/DiscoveredDevice";
import type { UsbHidTransport } from "@internal/usb/transport/UsbHidTransport";

/**
 * Starts discovering devices connected via USB HID (BLE not implemented yet).
 *
 * For the WebHID implementation, this use-case needs to be called as a result of an user interaction (button "click" event for ex).
 */
@injectable()
export class StartDiscoveringUseCase {
  constructor(
    @inject(usbDiTypes.UsbHidTransport)
    private usbHidTransport: UsbHidTransport,
    // Later: @inject(usbDiTypes.BleTransport) private bleTransport: BleTransport,
  ) {}

  execute(): Observable<DiscoveredDevice> {
    return this.usbHidTransport.startDiscovering();
  }
}
