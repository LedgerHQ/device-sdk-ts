import { Platform } from "react-native";
import {
  BleError,
  type BleManager,
  type Device,
  State,
  type Subscription as BleSubscription,
} from "react-native-ble-plx";
import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type BleDeviceInfos,
  type ConnectError,
  DeviceConnectionStateMachine,
  type DeviceConnectionStateMachineParams,
  type DeviceId,
  type DeviceModelDataSource,
  type DisconnectHandler,
  type DmkError,
  type LoggerPublisherService,
  OpeningConnectionError,
  type Transport,
  TransportConnectedDevice,
  type TransportDeviceModel,
  type TransportDiscoveredDevice,
  type TransportIdentifier,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { Either, EitherAsync, Left, Maybe, Nothing, Right } from "purify-ts";
import {
  BehaviorSubject,
  defer,
  filter,
  finalize,
  from,
  type Observable,
  retry,
  type Subscription,
  switchMap,
  tap,
  throttleTime,
  throwError,
} from "rxjs";

import {
  BLE_DISCONNECT_TIMEOUT_ANDROID,
  BLE_DISCONNECT_TIMEOUT_IOS,
  CONNECTION_LOST_DELAY,
  DEFAULT_MTU,
} from "@api/model/Const";
import {
  BleNotSupported,
  BlePermissionsNotGranted,
  DeviceConnectionNotFound,
  NoDeviceModelFoundError,
  PeerRemovedPairingError,
} from "@api/model/Errors";
import { type PermissionsService } from "@api/permissions/PermissionsService";
import {
  RNBleApduSender,
  type RNBleApduSenderConstructorArgs,
  type RNBleApduSenderDependencies,
  type RNBleInternalDevice,
} from "@api/transport/RNBleApduSender";

export const rnBleTransportIdentifier = "RN_BLE";

type InternalScannedDevice = {
  device: Device;
  timestamp: number;
};

export class RNBleTransport implements Transport {
  private _logger: LoggerPublisherService;
  private _deviceConnectionsById: Map<
    DeviceId,
    DeviceConnectionStateMachine<RNBleApduSenderDependencies>
  >;
  // private readonly _manager: BleManager;
  private readonly identifier: TransportIdentifier = "RN_BLE";
  private _reconnectionSubscription: Maybe<Subscription>;
  private readonly _bleStateSubject: BehaviorSubject<State> =
    new BehaviorSubject<State>(State.Unknown);

  constructor(
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    private readonly _loggerServiceFactory: (
      tag: string,
    ) => LoggerPublisherService,
    private readonly _apduSenderFactory: ApduSenderServiceFactory,
    private readonly _apduReceiverFactory: ApduReceiverServiceFactory,
    private readonly _manager: BleManager,
    private readonly _platform: Platform,
    private readonly _permissionsService: PermissionsService,
    private readonly _deviceConnectionStateMachineFactory: (
      args: DeviceConnectionStateMachineParams<RNBleApduSenderDependencies>,
    ) => DeviceConnectionStateMachine<RNBleApduSenderDependencies> = (args) =>
      new DeviceConnectionStateMachine(args),
    private readonly _deviceApduSenderFactory: (
      args: RNBleApduSenderConstructorArgs,
      loggerFactory: (tag: string) => LoggerPublisherService,
    ) => RNBleApduSender = (args, loggerFactory) =>
      new RNBleApduSender(args, loggerFactory),
  ) {
    this._logger = _loggerServiceFactory("ReactNativeBleTransport");
    this._deviceConnectionsById = new Map();
    this._reconnectionSubscription = Maybe.zero();
    this._manager.onStateChange((state) => {
      this._logger.debug(`[manager.onStateChange] called with state: ${state}`);
      this._bleStateSubject.next(state);
      if (state === State.Unknown) {
        // There seems to be a bug in the library where the state is not updated after going in an Unknown state...
        this._logger.debug(
          "[manager.onStateChange] forcing state update from Unknown",
        );
        this._manager.state().then((s) => {
          this._logger.debug(`[manager.onStateChange] new state: ${s}`);
          this._bleStateSubject.next(s);
        });
      }
    }, true);
  }

  /**
   * Not implemented for now as the return signature is not really usable.
   * Use listenToAvailableDevices instead.
   */
  startDiscovering(): Observable<TransportDiscoveredDevice> {
    return from([]);
  }

  /**
   * Stops the device scanning operation currently in progress.
   *
   * @return {Promise<void>} A promise that resolves once the device scanning has been successfully stopped.
   */
  async stopDiscovering(): Promise<void> {
    await this._stopScanning();
  }

  private _scannedDevicesSubject: BehaviorSubject<InternalScannedDevice[]> =
    new BehaviorSubject<InternalScannedDevice[]>([]);
  private _startedScanningSubscriber: Subscription | undefined = undefined;

  private _startScanning() {
    if (this._startedScanningSubscriber != undefined) {
      this._logger.info("[startScanning] !! startScanning already started");
      return;
    }

    //Reset the scanned devices list as new scan will start
    this._scannedDevicesSubject.next([]);

    this._logger.info("[startScanning] startScanning");

    this._startedScanningSubscriber = from(this._bleStateSubject)
      .pipe(
        tap(() => {
          if (!this.isSupported()) {
            throw new BleNotSupported("BLE not supported");
          }
        }),
        tap(() => {
          this._logger.debug("[startScanning] after isSupported");
        }),
        filter((state) => {
          const res = state === "PoweredOn";
          this._logger.info("[startScanning] BLE state", { data: { state } });
          return res;
        }),
        tap(() => {
          this._logger.debug("[startScanning] after filter");
        }),
        switchMap(async () => this.checkAndRequestPermissions()),
        tap(() => {
          this._logger.debug(
            "[startScanning] after checkAndRequestPermissions",
          );
        }),
        switchMap((hasPermissions) => {
          if (!hasPermissions) {
            return throwError(
              () => new BlePermissionsNotGranted("Permissions not granted"),
            );
          }

          const subject = new BehaviorSubject<InternalScannedDevice[]>([]);
          const devicesById = new Map<string, InternalScannedDevice>();

          this._logger.info("[startScanning] startDeviceScan");
          this._manager.startDeviceScan(
            this._deviceModelDataSource.getBluetoothServices(),
            { allowDuplicates: true },
            (error, rnDevice) => {
              if (error || !rnDevice) {
                subject.error(error || new Error("scan error"));
                return;
              }
              devicesById.set(rnDevice.id, {
                device: rnDevice,
                timestamp: Date.now(),
              });
              subject.next(Array.from(devicesById.values()));
            },
          );

          this._logger.debug("[startScanning] after startDeviceScan");

          /**
           * In case there is no update from startDeviceScan, we still emit the
           * list of devices. This is useful for instance if there is only 1 device
           * in the vicinity and it just got turned off. It will not "advertise"
           * anymore so startDeviceScan won't trigger.
           */
          const interval = setInterval(() => {
            subject.next(Array.from(devicesById.values()));
          }, 1000);

          return subject.asObservable().pipe(
            finalize(() => {
              this._logger.debug("[RNBleTransport][startScanning] finalize");
              subject.complete();
              clearInterval(interval);
              this._stopScanning();
            }),
          );
        }),
        throttleTime(1000),
      )
      .subscribe({
        next: (devices) => {
          this._scannedDevicesSubject.next(devices);
        },
        error: (error) => {
          this._logger.error("Error while scanning", { data: { error } });
          this._scannedDevicesSubject.error(error);
        },
      });
  }

  private async _stopScanning(): Promise<void> {
    this._logger.debug("[stopScanning] stopScanning");
    await this._manager.stopDeviceScan();
    //Stop listening the observable from this._startScanning()
    this._startedScanningSubscriber?.unsubscribe();
    this._startedScanningSubscriber = undefined;

    return;
  }

  /**
   * Listens to known devices and emits updates when new devices are discovered or when properties of existing devices are updated.
   *
   * @return {Observable<TransportDiscoveredDevice[]>} An observable stream of discovered devices, containing device information as an array of TransportDiscoveredDevice objects.
   */
  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    this._startScanning();

    return this._scannedDevicesSubject.asObservable().pipe(
      switchMap(async (internalScannedDevices) => {
        const eitherScannedDevices = internalScannedDevices
          .filter(
            ({ timestamp }) => timestamp > Date.now() - CONNECTION_LOST_DELAY,
          )
          .sort(
            (a, b) =>
              (b.device.rssi ?? -Infinity) - (a.device.rssi ?? -Infinity), // RSSI is a negative value and the higher, the stronger the signal
          )
          .map(({ device }) =>
            this._mapDeviceToTransportDiscoveredDevice(
              device,
              device.serviceUUIDs,
            ),
          )
          .filter((d) => !!d);

        const scannedDevices = Either.rights(eitherScannedDevices);

        const rawConnectedDevices = await this._manager.connectedDevices(
          this._deviceModelDataSource.getBluetoothServices(),
        );

        const eitherConnectedDevices = await Promise.all(
          rawConnectedDevices.map(async (device) => {
            try {
              const services = await device.services();
              const servicesUUIDs = services.map((s) => s.uuid);
              return this._mapDeviceToTransportDiscoveredDevice(
                device,
                servicesUUIDs,
              );
            } catch (e) {
              this._logger.error(
                "[listenToAvailableDevices] Error in mapping device to transport discovered device",
                {
                  data: { e },
                },
              );
              return Left(
                new NoDeviceModelFoundError(
                  `Error in mapping device to transport discovered device: ${e}`,
                ),
              );
            }
          }),
        );

        const connectedDevices = Either.rights(eitherConnectedDevices);

        this._logger.debug("[listenToAvailableDevices]", {
          data: {
            rawConnectedDevices: rawConnectedDevices.map((d) => d.name),
            connectedDevices: connectedDevices.map((d) => d.name),
            scannedDevices: scannedDevices.map((d) => d.name),
          },
        });

        /** We return both connected and scanned devices, as scanned devices don't include connected devices */
        return [...connectedDevices, ...scannedDevices];
      }),
    );
  }

  private _mapServicesUUIDsToBluetoothDeviceInfo(
    servicesUUIDs: string[] | null | undefined,
  ): Either<NoDeviceModelFoundError, BleDeviceInfos> {
    for (const serviceUUID of servicesUUIDs || []) {
      const bluetoothServiceInfo =
        this._deviceModelDataSource.getBluetoothServicesInfos()[serviceUUID];
      if (bluetoothServiceInfo) return Right(bluetoothServiceInfo);
    }

    return Left(
      new NoDeviceModelFoundError(
        `No device model found for [uuids=${servicesUUIDs}]`,
      ),
    );
  }

  private _mapServicesUUIDsToDeviceModel(
    servicesUUIDs: string[] | null | undefined,
  ): Either<NoDeviceModelFoundError, TransportDeviceModel> {
    const bluetoothServiceInfo =
      this._mapServicesUUIDsToBluetoothDeviceInfo(servicesUUIDs);
    return bluetoothServiceInfo.map((info) => info.deviceModel);
  }

  private _mapDeviceToTransportDiscoveredDevice(
    device: Device,
    servicesUUIDs: string[] | null | undefined,
  ): Either<NoDeviceModelFoundError, TransportDiscoveredDevice> {
    const deviceModel = this._mapServicesUUIDsToDeviceModel(servicesUUIDs);
    return deviceModel.map((model) => ({
      id: device.id,
      name: device.localName || device.name || "",
      deviceModel: model,
      transport: this.identifier,
      rssi: device.rssi || undefined,
    }));
  }

  /**
   * Establishes a connection to a device and configures the necessary parameters for communication.
   *
   * @param {Object} params - An object containing parameters required for the connection.
   * @param {DeviceId} params.deviceId - The unique identifier of the device to connect to.
   * @param {DisconnectHandler} params.onDisconnect - A callback function to handle device disconnection.
   * @returns {Promise<Either<ConnectError, TransportConnectedDevice>>} A promise resolving to either a connection error or a successfully connected device.
   */
  async connect(params: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    this._logger.debug("[connect] Called", {
      data: { deviceId: params.deviceId },
    });
    const existing = this._deviceConnectionsById.get(params.deviceId);
    if (existing) {
      this._logger.debug("[connect] Existing device connection found", {
        data: { deviceId: params.deviceId },
      });
      const deviceModel =
        existing.getDependencies().internalDevice.bleDeviceInfos.deviceModel;
      return Right(
        new TransportConnectedDevice({
          id: params.deviceId,
          deviceModel: deviceModel,
          type: "BLE",
          sendApdu: (...a) => existing.sendApdu(...a),
          transport: this.identifier,
        }),
      );
    }

    this._logger.debug(
      "[connect] No existing device connection found, establishing one",
      {
        data: { deviceId: params.deviceId },
      },
    );

    await this._stopScanning();
    await this._safeCancel(params.deviceId);

    return EitherAsync<ConnectError, TransportConnectedDevice>(
      async ({ throwE }) => {
        let device: Device;
        let servicesUUIDs: string[] = [];
        try {
          await this._manager.connectToDevice(params.deviceId, {
            requestMTU: DEFAULT_MTU,
          });

          device =
            await this._manager.discoverAllServicesAndCharacteristicsForDevice(
              params.deviceId,
            );

          servicesUUIDs = (await device.services()).map((s) => s.uuid);
        } catch (error) {
          if (
            error instanceof BleError &&
            (error.iosErrorCode as number) === 14
          ) {
            /**
             * This happens when the Ledger device reset its pairing, but the
             * iOS system still has that device paired.
             */
            return throwE(new PeerRemovedPairingError(error));
          }
          return throwE(new OpeningConnectionError(error));
        }

        const disconnectionSubscription = this._listenToDeviceDisconnected(
          params.deviceId,
        );

        const bleDeviceInfos = this._mapServicesUUIDsToBluetoothDeviceInfo(
          servicesUUIDs,
        ).caseOf({
          Right: (info) => {
            return info;
          },
          Left: (error) => {
            return throwE(new OpeningConnectionError(error));
          },
        });

        const deviceModel = bleDeviceInfos.deviceModel;

        const internalDevice: RNBleInternalDevice = {
          id: device.id,
          bleDeviceInfos,
        };

        const deviceApduSender = this._deviceApduSenderFactory(
          {
            apduSenderFactory: this._apduSenderFactory,
            apduReceiverFactory: this._apduReceiverFactory,
            dependencies: { device, internalDevice, manager: this._manager },
          },
          this._loggerServiceFactory,
        );

        const reconnectionTimeout =
          Platform.OS === "ios"
            ? BLE_DISCONNECT_TIMEOUT_IOS
            : BLE_DISCONNECT_TIMEOUT_ANDROID;

        const deviceConnectionStateMachine =
          this._deviceConnectionStateMachineFactory({
            deviceId: params.deviceId,
            deviceApduSender,
            timeoutDuration: reconnectionTimeout,
            tryToReconnect: () => this.tryToReconnect(params.deviceId),
            onTerminated: async () => {
              this._logger.debug("[onTerminated]", {
                data: { deviceId: params.deviceId },
              });
              try {
                await this._safeCancel(params.deviceId);
              } catch (e) {
                this._logger.error(
                  "[onTerminated] Error in termination of device connection",
                  { data: { e } },
                );
              } finally {
                this._deviceConnectionsById.delete(params.deviceId);
                this._reconnectionSubscription.ifJust((sub) => {
                  sub.unsubscribe();
                  this._reconnectionSubscription = Maybe.zero();
                });
                this._logger.debug("[onTerminated] signaling disconnection", {
                  data: { deviceId: params.deviceId },
                });
                params.onDisconnect(params.deviceId);
              }
            },
          });

        await deviceApduSender.setupConnection().catch((e) => {
          this._safeCancel(params.deviceId);
          disconnectionSubscription.remove();
          throw e;
        });

        this._deviceConnectionsById.set(
          params.deviceId,
          deviceConnectionStateMachine,
        );

        return new TransportConnectedDevice({
          id: device.id,
          deviceModel: deviceModel,
          type: "BLE",
          sendApdu: (...args) => deviceConnectionStateMachine.sendApdu(...args),
          transport: this.identifier,
        });
      },
    ).run();
  }

  /**
   * Terminates the connection with the connected device and cleans up related resources.
   *
   * @param {TransportConnectedDevice} params.connectedDevice - The connected device to be disconnected.
   * @return {Promise<Either<DmkError, void>>} A promise resolving to either a success (void) or a failure (DmkError) value.
   */
  async disconnect(params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    const deviceId = params.connectedDevice.id;
    const deviceConnection = this._deviceConnectionsById.get(deviceId);
    if (!deviceConnection) {
      throw new UnknownDeviceError(
        `No connected device found with id ${deviceId}`,
      );
    }

    deviceConnection.closeConnection();

    return Promise.resolve(Right(undefined));
  }

  /**
   * Determines if the feature or permission is supported.
   *
   * This method evaluates the current state of the `_isSupported` property to determine
   * whether the relevant feature is supported or throws an error if its state has
   * not been initialized properly.
   *
   * @return {boolean} Returns `true` if the feature is supported, otherwise `false`.
   * Throws an error if the `_isSupported` property has not been initialized.
   */
  isSupported(): boolean {
    return ["android", "ios"].includes(this._platform.OS);
  }

  /**
   * Retrieves the transport identifier associated with the object.
   *
   * @return {TransportIdentifier} The transport identifier.
   */
  getIdentifier(): TransportIdentifier {
    return this.identifier;
  }

  /**
   * Checks if the necessary permissions are granted and requests them if not.
   */
  async checkAndRequestPermissions(): Promise<boolean> {
    this._logger.debug("[checkAndRequestPermissions] Called");

    const checkResult =
      await this._permissionsService.checkRequiredPermissions();
    if (checkResult) return true;

    const requestResult =
      await this._permissionsService.requestRequiredPermissions();
    return requestResult;
  }

  /**
   * Handles the event when a Bluetooth device gets disconnected. This method attempts
   * to reconnect to the device, retries a certain number of times on failure, and
   * invokes a callback if the reconnection does not succeed.
   *
   * @param {BleError | null} error - The error object representing the reason for the disconnection, or null if no error occurred.
   * @param {Device | null} device - The Bluetooth device that was disconnected, or null if no device is provided.
   * @return {void}
   */
  private _handleDeviceDisconnected(
    error: BleError | null,
    device: Device | null,
  ) {
    this._logger.debug("[_handleDeviceDisconnected]", {
      data: { error, device },
    });
    if (!device) {
      this._logger.debug(
        "[_handleDeviceDisconnected] disconnected handler didn't find device",
      );
      return;
    }
    if (!device?.id || !this._deviceConnectionsById.has(device?.id)) return;
    if (error) {
      this._logger.error("device disconnected error", {
        data: { error, device },
      });
      return;
    }
    const deviceId = device.id;

    Maybe.fromNullable(this._deviceConnectionsById.get(deviceId)).map(
      (deviceConnection) => deviceConnection.eventDeviceDisconnected(),
    );
  }

  private _listenToDeviceDisconnected(deviceId: DeviceId): BleSubscription {
    const disconnectionSubscription = this._manager.onDeviceDisconnected(
      deviceId,
      (error, d) => {
        this._handleDeviceDisconnected(error, d);
        disconnectionSubscription.remove();
      },
    );
    return disconnectionSubscription;
  }

  private async tryToReconnect(deviceId: DeviceId) {
    this._logger.debug("[tryToReconnect] Called", {
      data: { deviceId },
    });
    let reconnectionTryCount = 0;

    await this._stopScanning();
    await this._safeCancel(deviceId);

    const reconnect$ = defer(async () => {
      let disconnectionSubscription: BleSubscription | null = null;
      reconnectionTryCount++;
      try {
        this._logger.debug(
          `[tryToReconnect](try=${reconnectionTryCount}) Reconnecting to device`,
          {
            data: { id: deviceId },
          },
        );
        const reconnectedDevice = await this._manager.connectToDevice(
          deviceId,
          { requestMTU: DEFAULT_MTU, timeout: 2000 },
        );
        this._logger.debug(
          `[tryToReconnect](try=${reconnectionTryCount}) Established connection to device`,
          {
            data: { id: deviceId },
          },
        );
        const usableReconnectedDevice =
          await reconnectedDevice.discoverAllServicesAndCharacteristics();
        this._logger.debug(
          `[tryToReconnect](try=${reconnectionTryCount}) Discovered all services and characteristics`,
          { data: { usableReconnectedDevice } },
        );
        disconnectionSubscription = this._listenToDeviceDisconnected(deviceId);
        await this._handleDeviceReconnected(usableReconnectedDevice);
        return usableReconnectedDevice;
      } catch (e) {
        this._logger.warn(
          `[tryToReconnect](try=${reconnectionTryCount}) Reconnecting to device failed`,
          {
            data: { e },
          },
        );
        disconnectionSubscription?.remove();
        await this._stopScanning();
        await this._safeCancel(deviceId);
        throw e;
      }
    }).pipe(retry(5));

    this._reconnectionSubscription = Maybe.of(
      reconnect$.subscribe({
        next: (d) =>
          this._logger.debug(
            `[tryToReconnect](try=${reconnectionTryCount}) Fully reconnected to device (id=${d.id})`,
          ),
        complete: () => {
          this._logger.debug("[tryToReconnect] Completed");
          this._reconnectionSubscription = Maybe.zero();
        },
        error: (e) => {
          this._logger.error(
            `[tryToReconnect] All reconnection attempts failed`,
            { data: { e } },
          );
          this._deviceConnectionsById.get(deviceId)?.closeConnection();
          this._reconnectionSubscription = Maybe.zero();
        },
      }),
    );
  }

  /**
   * Handles the reconnection of a device. Configures the device connection and its corresponding
   * internal device upon reconnection, including updating the connection state, registering
   * callbacks for write and monitor operations, and initiating a reconnect operation.
   *
   * @param {Device} device - The ddevice object that has been reconnected. Contains device details,
   *                          such as the device ID.
   * @return {Promise<Either<DeviceConnectionNotFound | InternalDeviceNotFound, void>>} A promise that completes when the device reconnection has been fully
   *                         configured. Resolves with no value or rejects if an error occurs during
   *                         the reconnection process.
   */
  private async _handleDeviceReconnected(device: Device) {
    const errorOrDeviceConnection = Maybe.fromNullable(
      this._deviceConnectionsById.get(device.id),
    ).toEither(new DeviceConnectionNotFound());

    return EitherAsync(async ({ liftEither, throwE }) => {
      const deviceConnectionStateMachine = await liftEither(
        errorOrDeviceConnection,
      );

      const servicesUUIDs = (await device.services()).map((s) => s.uuid);

      const internalDevice = this._mapServicesUUIDsToBluetoothDeviceInfo(
        servicesUUIDs,
      ).caseOf({
        Right: (info) => {
          return {
            id: device.id,
            bleDeviceInfos: info,
          };
        },
        Left: (error) => {
          this._logger.error(
            "[_handleDeviceReconnected] Error in mapping services UUIDs to Bluetooth device info",
            {
              data: { error },
            },
          );

          return throwE(error);
        },
      });

      deviceConnectionStateMachine.setDependencies({
        device,
        manager: this._manager,
        internalDevice,
      });

      await deviceConnectionStateMachine.setupConnection().catch((e) => {
        this._safeCancel(device.id);
        throw e;
      });

      deviceConnectionStateMachine.eventDeviceConnected();
    }).run();
  }

  private async _safeCancel(deviceId: DeviceId) {
    // only invoke if the BleManager under test actually has it
    if (typeof this._manager.cancelDeviceConnection === "function") {
      const connectedDevices = await this._manager.connectedDevices(
        this._deviceModelDataSource.getBluetoothServices(),
      );

      for (const device of connectedDevices) {
        if (device.id === deviceId) {
          try {
            await this._manager.cancelDeviceConnection(deviceId);
          } catch (e) {
            this._logger.error(
              "[safeCancel] Error in cancelling device connection",
              {
                data: { e },
              },
            );
          }
        }
      }
    }
  }
}
