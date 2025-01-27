import {
  type ConnectError,
  type DeviceId,
  type DeviceModelDataSource,
  DisconnectError,
  type DisconnectHandler,
  type DmkError,
  type LoggerPublisherService,
  LogLevel,
  type Transport,
  TransportConnectedDevice,
  type TransportDiscoveredDevice,
  type TransportIdentifier,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { Observable } from "rxjs";

import { getObservableOfArraysNewItems } from "@api/helpers/getObservableOfArraysNewItems";
import { TRANSPORT_IDENTIFIER } from "@api/transport/rnHidTransportIdentifier";

import { type NativeModuleWrapper } from "./NativeModuleWrapper";

export class RNHidTransport implements Transport {
  private _loggerService: LoggerPublisherService;

  constructor(
    private readonly _isSupported: boolean,
    // @ts-expect-error not used for now
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    private readonly _loggerServiceFactory: (
      tag: string,
    ) => LoggerPublisherService,
    private readonly _nativeModuleWrapper: NativeModuleWrapper,
  ) {
    this._loggerService = this._loggerServiceFactory("RNHidTransport");
    // TODO: should this really be done in the constructor ? maybe better to do this initialisation lazily
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
     * That's why we create a new observable rather than returning the one
     * returned by subscribeToDiscoveredDevicesEvents.
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
    onDisconnect: DisconnectHandler; // TODO: implement onDisconnect
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    return this._nativeModuleWrapper
      .connectDevice(_params.deviceId)
      .then((result) => {
        return result.map(
          ({ sessionId, transportDeviceModel: deviceModel }) => {
            return new TransportConnectedDevice({
              id: sessionId,
              deviceModel,
              sendApdu: async (apdu) => {
                return this._nativeModuleWrapper.sendApdu(sessionId, apdu);
              },
              transport: this.getIdentifier(),
              type: "USB",
            });
          },
        );
      });
  }

  disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    return this._nativeModuleWrapper
      .disconnectDevice(_params.connectedDevice.id)
      .then(() => Right(undefined))
      .catch((error) => {
        return Left(new DisconnectError(error));
      });
  }
}
