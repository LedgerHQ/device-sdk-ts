import { inject, injectable } from "inversify";
import { map, Observable } from "rxjs";

import { DeviceModel } from "@api/index";
import { DiscoveredDevice } from "@api/types";
import { usbDiTypes } from "@internal/usb/di/usbDiTypes";
import { InternalDiscoveredDevice } from "@internal/usb/model/InternalDiscoveredDevice";
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
    return this.usbHidTransport.startDiscovering().pipe(
      map((data: InternalDiscoveredDevice) => {
        const deviceModel = new DeviceModel({
          id: data.id,
          model: data.deviceModel.id,
          name: data.deviceModel.productName,
        });
        return {
          id: data.id,
          deviceModel,
        };
      }),
    );
  }
}
