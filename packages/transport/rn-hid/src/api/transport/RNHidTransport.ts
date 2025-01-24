import { Platform } from "react-native";
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
import { filter, map, type Observable, tap } from "rxjs";

import { subscribeToDiscoveredDevicesEvents } from "@api/bridge/events";
import { getObservableOfArraysNewItems } from "@api/bridge/getObservableOfArraysNewItems";
import { mapNativeDiscoveryDeviceToTransportDiscoveredDevice } from "@api/bridge/mapper";
import { NativeTransportModule } from "@api/bridge/nativeModule";
import { TRANSPORT_IDENTIFIER } from "@api/transport/rnHidTransportIdentifier";

export class RNHidTransport implements Transport {
  constructor(
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    // @ts-expect-error not used yet
    private readonly _loggerServiceFactory: (
      tag: string,
    ) => LoggerPublisherService,
  ) {}

  getIdentifier(): TransportIdentifier {
    return TRANSPORT_IDENTIFIER;
  }

  isSupported(): boolean {
    return Platform.OS === "android" && !!NativeTransportModule;
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    const observable = getObservableOfArraysNewItems(
      subscribeToDiscoveredDevicesEvents(),
      (deviceA, deviceB) => deviceA.uid === deviceB.uid,
    ).pipe(
      tap((device) => {
        console.log("NEW nativedevice detected", device);
      }),
      map((nativeDevice) =>
        mapNativeDiscoveryDeviceToTransportDiscoveredDevice(
          nativeDevice,
          this._deviceModelDataSource,
        ),
      ),
      filter((device) => device != null),
      tap((device) => {
        console.log("NEW device detected", device);
      }),
    );
    NativeTransportModule.startDiscovering().catch((error) => {
      console.error("startDiscovering error", error);
    });
    return observable;
  }

  stopDiscovering(): void {
    NativeTransportModule.stopDiscovering().catch((error) => {
      console.error("stopDiscovering error", error);
    });
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
