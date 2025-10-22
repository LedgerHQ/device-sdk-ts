import {
  type ConnectError,
  type DeviceId,
  DisconnectError,
  type DisconnectHandler,
  type DmkError,
  type LoggerPublisherService,
  LogLevel,
  OpeningConnectionError,
  type Transport,
  TransportConnectedDevice,
  type TransportDiscoveredDevice,
  type TransportIdentifier,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { Observable } from "rxjs";

import { getObservableOfArraysNewItems } from "@api/helpers/getObservableOfArraysNewItems";
import { TRANSPORT_IDENTIFIER } from "@api/transport/rnHidTransportIdentifier";

import { HidTransportSendApduUnknownError } from "./Errors";
import { type NativeModuleWrapper } from "./NativeModuleWrapper";

export class RNHidTransport implements Transport {
  private _loggerService: LoggerPublisherService;

  constructor(
    private readonly _isSupported: boolean,
    private readonly _nativeModuleWrapper: NativeModuleWrapper,
    _loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._loggerService = _loggerServiceFactory("RNHidTransport");
    this._nativeModuleWrapper.subscribeToTransportLogs().subscribe((log) => {
      const [logLevel, message, options] = log;
      const logMethod = {
        [LogLevel.Fatal]: this._loggerService.error.bind(this._loggerService),
        [LogLevel.Error]: this._loggerService.error.bind(this._loggerService),
        [LogLevel.Warning]: this._loggerService.warn.bind(this._loggerService),
        [LogLevel.Info]: this._loggerService.info.bind(this._loggerService),
        [LogLevel.Debug]: this._loggerService.debug.bind(this._loggerService),
      }[logLevel];
      logMethod(message, options);
    });
  }

  getIdentifier(): TransportIdentifier {
    return TRANSPORT_IDENTIFIER;
  }

  isSupported(): boolean {
    return this._isSupported;
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    const observable = new Observable<TransportDiscoveredDevice>(
      (subscriber) => {
        const subscription = getObservableOfArraysNewItems(
          this._nativeModuleWrapper.subscribeToDiscoveredDevicesEvents(),
          (device) => device.id,
        ).subscribe(subscriber);

        this._nativeModuleWrapper.startScan().catch((error) => {
          subscriber.error(error);
          this._loggerService.error("startDiscovering error", error);
        });
        return () => subscription.unsubscribe();
      },
    );
    return observable;
  }

  stopDiscovering(): void {
    this._nativeModuleWrapper.stopScan().catch((error) => {
      this._loggerService.error("stopDiscovering error", error);
    });
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    /**
     * NB: here we need to define the unsubscribe logic as there is no
     * "stopListeningToKnownDevices" method.
     * That's why we create a new observable rather than returning the one
     * returned by subscribeToDiscoveredDevicesEvents.
     */
    const observable = new Observable<TransportDiscoveredDevice[]>(
      (subscriber) => {
        const subscription = this._nativeModuleWrapper
          .subscribeToDiscoveredDevicesEvents()
          .subscribe((devices) => {
            subscriber.next(devices);
          });
        this._nativeModuleWrapper.startScan().catch((error) => {
          this._loggerService.error("startDiscovering error", error);
          subscriber.error(error);
        });
        return () => {
          subscription.unsubscribe();
          this._nativeModuleWrapper.stopScan().catch((error) => {
            this._loggerService.error("stopDiscovering error", error);
          });
        };
      },
    );
    return observable;
  }

  connect(_params: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    return this._nativeModuleWrapper
      .connectDevice(_params.deviceId)
      .then((result) => {
        return result.map(
          ({ sessionId, transportDeviceModel: deviceModel }) => {
            const sub = this._nativeModuleWrapper
              .subscribeToDeviceDisconnectedEvents()
              .subscribe((device) => {
                if (device.sessionId === sessionId) {
                  _params.onDisconnect(sessionId);
                  sub.unsubscribe();
                }
              });

            return new TransportConnectedDevice({
              id: sessionId,
              deviceModel,
              sendApdu: async (
                apdu,
                triggersDisconnection = false,
                abortTimeout = -1,
              ) => {
                return this._nativeModuleWrapper
                  .sendApdu(
                    sessionId,
                    apdu,
                    triggersDisconnection,
                    abortTimeout,
                  )
                  .catch((e) => Left(new HidTransportSendApduUnknownError(e)));
              },
              transport: this.getIdentifier(),
              type: "USB",
            });
          },
        );
      })
      .catch((error) => {
        return Left(new OpeningConnectionError(error));
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
