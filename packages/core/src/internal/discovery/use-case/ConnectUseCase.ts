import { inject, injectable } from "inversify";
import { from, Observable, of, switchMap } from "rxjs";

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

  execute({ deviceId }: ConnectUseCaseArgs): Observable<ConnectedDevice> {
    return from(this.usbHidTransport.connect({ deviceId })).pipe(
      switchMap((either) => {
        return either.caseOf({
          Left: (error) => {
            throw error;
          },
          Right: (connectedDevice) => {
            return of(connectedDevice);
          },
        });
      }),
    );
  }
}
