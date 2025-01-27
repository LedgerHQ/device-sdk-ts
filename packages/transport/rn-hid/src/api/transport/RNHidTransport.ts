import {
  type ConnectError,
  type DeviceId,
  type DeviceModelDataSource,
  type DmkError,
  type LoggerPublisherService,
  LogLevel,
  type Transport,
  type TransportConnectedDevice,
  type TransportDiscoveredDevice,
  type TransportIdentifier,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";
import { Observable } from "rxjs";

import { getObservableOfArraysNewItems } from "@api/helpers/getObservableOfArraysNewItems";
import { TRANSPORT_IDENTIFIER } from "@api/transport/rnHidTransportIdentifier";

import { type NativeModuleWrapper } from "./NativeModuleWrapper";

export class RNHidTransport implements Transport {
  private _loggerService: LoggerPublisherService;

  constructor(
    private readonly _isSupported: boolean,
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    private readonly _loggerServiceFactory: (
      tag: string,
    ) => LoggerPublisherService,
    private readonly _nativeModuleWrapper: NativeModuleWrapper,
  ) {
    this._loggerService = this._loggerServiceFactory("RNHidTransport");
    this._nativeModuleWrapper.subscribeToTransportLogs().subscribe((log) => {
      const message = `[NativeModule][${log.tag}] ${log.message}`;
      const logMethod = {
        [LogLevel.Fatal]: this._loggerService.error,
        [LogLevel.Error]: this._loggerService.error,
        [LogLevel.Warning]: this._loggerService.warn,
        [LogLevel.Info]: this._loggerService.info,
        [LogLevel.Debug]: this._loggerService.debug,
      }[LogLevel[log.level]];
      if (!logMethod) {
        console.warn("Unknown log level", log.level);
        return;
      }
      logMethod(message, { data: log.jsonPayload });
    });
  }

  getIdentifier(): TransportIdentifier {
    return TRANSPORT_IDENTIFIER;
  }

  isSupported(): boolean {
    return this._isSupported;
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    const observable = getObservableOfArraysNewItems(
      this._nativeModuleWrapper.subscribeToDiscoveredDevicesEvents(),
      (deviceA, deviceB) => deviceA.id === deviceB.id,
    );
    this._nativeModuleWrapper.startScan().catch((error) => {
      console.error("startDiscovering error", error);
    });
    return observable;
  }

  stopDiscovering(): void {
    this._nativeModuleWrapper.stopScan().catch((error) => {
      console.error("stopDiscovering error", error);
    });
  }

  listenToKnownDevices(): Observable<TransportDiscoveredDevice[]> {
    /**
     * NB: here we need to define the unsubscribe logic as there is no
     * "stopListeningToKnownDevices" method.
     */
    const observable = new Observable<TransportDiscoveredDevice[]>(
      (subscriber) => {
        this._nativeModuleWrapper
          .subscribeToDiscoveredDevicesEvents()
          .subscribe((devices) => {
            subscriber.next(devices);
          });
        return () => {
          this._nativeModuleWrapper.stopScan().catch((error) => {
            console.error("stopDiscovering error", error);
          });
        };
      },
    );
    this._nativeModuleWrapper.startScan().catch((error) => {
      console.error("startDiscovering error", error);
    });
    return observable;
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
