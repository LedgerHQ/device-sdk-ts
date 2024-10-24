import { type Either } from "purify-ts";
import { type Observable } from "rxjs";

import { type DeviceId } from "@api/device/DeviceModel";
import { type SdkError } from "@api/Error";
import { type ConnectError } from "@api/transport/model/Errors";
import { type TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import { type TransportIdentifier } from "@api/transport/model/TransportIdentifier";

import { type TransportConnectedDevice } from "./TransportConnectedDevice";

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

  startDiscovering(): Observable<TransportDiscoveredDevice>;

  stopDiscovering(): void;

  listenToKnownDevices(): Observable<TransportDiscoveredDevice[]>;

  /**
   * Enables communication with the device by connecting to it.
   *
   * @param params containing
   *  - id: the device id from the DTO discovered device
   */
  connect(params: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, TransportConnectedDevice>>;

  disconnect(params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<SdkError, void>>;
}
