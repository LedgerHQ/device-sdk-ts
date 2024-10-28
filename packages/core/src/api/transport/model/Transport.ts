import { type Either } from "purify-ts";
import { type Observable } from "rxjs";

import { type DeviceId } from "@api/device/DeviceModel";
import { type DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import {
  type ApduReceiverConstructorArgs,
  type ApduReceiverService,
} from "@api/device-session/service/ApduReceiverService";
import {
  type ApduSenderService,
  type ApduSenderServiceConstructorArgs,
} from "@api/device-session/service/ApduSenderService";
import { type SdkError } from "@api/Error";
import { type SdkConfig } from "@api/SdkConfig";
import { type ConnectError } from "@api/transport/model/Errors";
import { type TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import { type TransportIdentifier } from "@api/transport/model/TransportIdentifier";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

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

export type TransportArgs = {
  deviceModelDataSource: DeviceModelDataSource;
  loggerServiceFactory: (tag: string) => LoggerPublisherService;
  config: SdkConfig;
  apduSenderServiceFactory: (
    args: ApduSenderServiceConstructorArgs,
  ) => ApduSenderService;
  apduReceiverServiceFactory: (
    args: ApduReceiverConstructorArgs,
  ) => ApduReceiverService;
};

export type TransportFactory = (args: TransportArgs) => Transport;
