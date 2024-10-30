import { type Either } from "purify-ts";
import { type Observable } from "rxjs";

import { type DeviceId } from "@api/device/DeviceModel";
import { type DmkError } from "@api/Error";
import { type TransportIdentifier } from "@api/transport/model/TransportIdentifier";
import { type ConnectError } from "@internal/transport/model/Errors";
import { type InternalConnectedDevice } from "@internal/transport/model/InternalConnectedDevice";
import { type InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";

export type DisconnectHandler = (deviceId: DeviceId) => void;

/**
 * Transport interface
 */
export interface Transport {
  /**
   * Get the transport identifier, which is a string to uniquely identify that transport.
   */
  getIdentifier(): TransportIdentifier;

  isSupported(): boolean;

  startDiscovering(): Observable<InternalDiscoveredDevice>;

  stopDiscovering(): void;

  listenToKnownDevices(): Observable<InternalDiscoveredDevice[]>;

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
  }): Promise<Either<DmkError, void>>;
}
