import { Either } from "purify-ts";
import { Observable } from "rxjs";

import { SdkError } from "@api/Error";
import { DeviceId } from "@internal/device-model/model/DeviceModel";
import { DiscoveredDevice } from "@internal/usb/model/DiscoveredDevice";
import { ConnectError } from "@internal/usb/model/Errors";
import { InternalConnectedDevice } from "@internal/usb/model/InternalConnectedDevice";

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
  }): Promise<Either<ConnectError, InternalConnectedDevice>>;

  disconnect(params: {
    connectedDevice: InternalConnectedDevice;
  }): Promise<Either<SdkError, void>>;
}
