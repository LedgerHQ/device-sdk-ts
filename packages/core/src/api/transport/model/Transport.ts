import { Either } from "purify-ts";
import { Observable } from "rxjs";

import { DeviceId } from "@api/device/DeviceModel";
import { SdkError } from "@api/Error";
import { BuiltinTransport } from "@api/transport/model/BuiltinTransport";
import { ConnectError } from "@internal/transport/model/Errors";
import { InternalConnectedDevice } from "@internal/transport/model/InternalConnectedDevice";
import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";

export type DisconnectHandler = (deviceId: DeviceId) => void;

/**
 * Transport interface
 */
export interface Transport {
  /**
   * Get the transport identifier, which is a string to uniquely identify that transport.
   */
  getIdentifier(): BuiltinTransport;

  isSupported(): boolean;

  startDiscovering(): Observable<InternalDiscoveredDevice>;

  stopDiscovering(): void;

  /**
   * Enables communication with the device by connecting to it.
   *
   * @param params containing
   *  - id: the device id from the DTO discovered device
   */
  connect(params: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, InternalConnectedDevice>>;

  disconnect(params: {
    connectedDevice: InternalConnectedDevice;
  }): Promise<Either<SdkError, void>>;
}
