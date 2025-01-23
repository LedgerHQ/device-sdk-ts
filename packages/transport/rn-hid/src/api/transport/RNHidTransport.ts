import { NativeModules, Platform } from "react-native";
import {
  type ConnectError,
  type DeviceId,
  type DeviceModelDataSource,
  type DmkError,
  type LoggerPublisherService,
  type Transport,
  type TransportConnectedDevice,
  type TransportDiscoveredDevice,
  type TransportFactory,
  type TransportIdentifier,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";
import { type Observable } from "rxjs";

import { NATIVE_MODULE_NAME } from "@api/bridge/constants";

const NativeTransportModule = NativeModules[NATIVE_MODULE_NAME];

export const rnHidTransportIdentifier = "RN_HID";

export class RNHidTransport implements Transport {
  constructor(
    // @ts-expect-error
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    // @ts-expect-error
    private readonly _loggerServiceFactory: (
      tag: string,
    ) => LoggerPublisherService,
  ) {}
  getIdentifier(): TransportIdentifier {
    return rnHidTransportIdentifier;
  }
  isSupported(): boolean {
    return Platform.OS === "android" && !!NativeTransportModule;
  }
  startDiscovering(): Observable<TransportDiscoveredDevice> {
    // NativeEventEmitter listen device
    throw new Error("Method not implemented.");
  }
  stopDiscovering(): void {
    // NativeEventEmitter stop listen device
    throw new Error("Method not implemented.");
  }
  listenToKnownDevices(): Observable<TransportDiscoveredDevice[]> {
    // NativeEventEmitter start listen
    throw new Error("Method not implemented.");
  }
  connect(_params: {
    deviceId: DeviceId;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    // connect
    throw new Error("Method not implemented.");
  }
  disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    // disconnect
    throw new Error("Method not implemented.");
  }
}

export const RNHidTransportFactory: TransportFactory = ({
  deviceModelDataSource,
  loggerServiceFactory,
}) => new RNHidTransport(deviceModelDataSource, loggerServiceFactory);
