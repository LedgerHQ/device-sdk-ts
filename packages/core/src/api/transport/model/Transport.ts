import { Either } from "purify-ts";
import { Observable } from "rxjs";

import { DeviceId } from "@api/device/DeviceModel";
import { SdkError } from "@api/Error";
import { TransportIdentifier } from "@api/transport/model/TransportIdentifier";
import type { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
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
  getIdentifier(): TransportIdentifier;

  setLogger(logger: LoggerPublisherService): void;
  setDeviceModelDataSource(deviceModelDataSource: DeviceModelDataSource): void;
  setDeviceConnectionFactory(deviceConnectionFactory: unknown): void;

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
  }): Promise<Either<SdkError, void>>;
}
