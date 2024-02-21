import { Either } from "purify-ts";
import { Observable } from "rxjs";

import { DeviceId } from "@internal/device-model/model/DeviceModel";
import { ConnectedDevice } from "@internal/usb/model/ConnectedDevice";
import { DiscoveredDevice } from "@internal/usb/model/DiscoveredDevice";
import { ConnectError } from "@internal/usb/model/Errors";

/**
 * Transport interface representing a USB HID communication
 */
export interface UsbHidTransport {
  isSupported(): boolean;

  startDiscovering(): Observable<DiscoveredDevice>;

  stopDiscovering(): void;

  /**
   * Enables communication with the device by connecting to it.
   *
   * @param params containing
   *  - id: the device id from the DTO discovered device
   */
  connect(params: {
    deviceId: DeviceId;
  }): Promise<Either<ConnectError, ConnectedDevice>>;
}
