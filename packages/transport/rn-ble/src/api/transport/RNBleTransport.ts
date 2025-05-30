import { PermissionsAndroid, Platform } from "react-native";
import { BleError, BleManager, type Device, State } from "react-native-ble-plx";
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
  type TransportFactory,
  type TransportIdentifier,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { Either, EitherAsync, Left, Maybe, Nothing, Right } from "purify-ts";
import {
  BehaviorSubject,
  filter,
  finalize,
  from,
  map,
  type Observable,
  retry,
  type Subscription,
  switchMap,
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
  DeviceConnectionNotFound,
  NoDeviceModelFoundError,
  PeerRemovedPairingError,
} from "@api/model/Errors";
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
  private _isSupported: Maybe<boolean>;
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
    private readonly _platform: Platform = Platform,
    private readonly _permissionsAndroid: PermissionsAndroid = PermissionsAndroid,
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
    this._isSupported = Maybe.zero();
    this._deviceConnectionsById = new Map();
    this._reconnectionSubscription = Maybe.zero();
    this._manager.onStateChange((state) => {
      this._bleStateSubject.next(state);
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

  private _maybeScanningSubject: Maybe<
    BehaviorSubject<InternalScannedDevice[]>
  > = Nothing;

  private _scannedDevicesSubject: BehaviorSubject<InternalScannedDevice[]> =
    new BehaviorSubject<InternalScannedDevice[]>([]);
  private _startedScanningSubscriber: Subscription | undefined = undefined;

  private _startScanning() {
    if (this._startedScanningSubscriber != undefined) {
      return;
    }

    //Reset the scanned devices list as new scan will start
    this._scannedDevicesSubject.next([]);

    this._startedScanningSubscriber = from(this._bleStateSubject)
      .pipe(
        filter((state) => state === "PoweredOn"),
        switchMap(() => this.requestPermission()),
        switchMap((isSupported) => {
          if (!isSupported) {
            return throwError(() => new BleNotSupported("BLE not supported"));
          }

          const subject = new BehaviorSubject<InternalScannedDevice[]>([]);
          this._maybeScanningSubject = Maybe.of(subject);
          const devicesById = new Map<string, InternalScannedDevice>();

          this._logger.info("[RNBleTransport][startScanning] startDeviceScan");
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
              this._maybeScanningSubject = Nothing;
              this._manager.stopDeviceScan();
            }),
          );
        }),
        throttleTime(1000),
      )
      .subscribe({
        next: (devices) => {
          this._logger.debug(
            "[RNBleTransport][startScanning] onNext called with devices",
            { data: { devices } },
          );
          this._scannedDevicesSubject.next(devices);
        },
        error: (error) => {
          this._logger.error("Error while scanning", { data: { error } });
        },
      });
  }

  private async _stopScanning(): Promise<void> {
    this._maybeScanningSubject.map((subject) => {
      subject.complete();
      this._maybeScanningSubject = Nothing;
    });

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
      map((internalScannedDevices) => {
        const eitherConnectedDevices = Array.from(
          this._deviceConnectionsById.values(),
        ).map((connection) =>
          this._mapDeviceToTransportDiscoveredDevice(
            connection.getDependencies().device,
            [
              connection.getDependencies().internalDevice.bleDeviceInfos
                .serviceUuid,
            ],
          ),
        );

        const connectedDevices = Either.rights(eitherConnectedDevices);

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
    const existing = this._deviceConnectionsById.get(params.deviceId);
    if (existing) {
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

        const disconnectionSubscription = this._manager.onDeviceDisconnected(
          device.id,
          (error, d) => {
            this._handleDeviceDisconnected(error, d);
          },
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
            onTerminated: () => {
              try {
                this._safeCancel(params.deviceId);
                params.onDisconnect(params.deviceId);
                this._deviceConnectionsById.delete(params.deviceId);
                disconnectionSubscription.remove();
                if (this._reconnectionSubscription.isJust()) {
                  this._reconnectionSubscription.map((sub) =>
                    sub.unsubscribe(),
                  );
                  this._reconnectionSubscription = Maybe.zero();
                }
              } catch (e) {
                this._logger.error(
                  "Error in termination of device connection",
                  { data: { e } },
                );
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
    return this._isSupported.caseOf({
      Just: (isSupported) => isSupported,
      Nothing: () => {
        throw new Error("Should initialize permission");
      },
    });
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
   * Requests the necessary permissions based on the operating system.
   * For iOS, it automatically sets the permissions as granted.
   * For Android, it checks and requests location, Bluetooth scan, and Bluetooth connect permissions, depending on the API level.
   * If permissions are granted, updates the internal support state and logs the result.
   *
   * @return {Promise<boolean>} A promise that resolves to true if the required permissions are granted, otherwise false.
   */
  async requestPermission(): Promise<boolean> {
    if (this._platform.OS === "ios") {
      this._isSupported = Maybe.of(true);
      return true;
    }

    if (
      this._platform.OS === "android" &&
      this._permissionsAndroid.PERMISSIONS["ACCESS_FINE_LOCATION"]
    ) {
      const apiLevel = parseInt(this._platform.Version.toString(), 10);

      if (apiLevel < 31) {
        const granted = await this._permissionsAndroid.request(
          this._permissionsAndroid.PERMISSIONS["ACCESS_FINE_LOCATION"],
        );
        this._isSupported = Maybe.of(
          granted === this._permissionsAndroid.RESULTS["GRANTED"],
        );
      }
      if (
        this._permissionsAndroid.PERMISSIONS["BLUETOOTH_SCAN"] &&
        this._permissionsAndroid.PERMISSIONS["BLUETOOTH_CONNECT"]
      ) {
        const result = await this._permissionsAndroid.requestMultiple([
          this._permissionsAndroid.PERMISSIONS["BLUETOOTH_SCAN"],
          this._permissionsAndroid.PERMISSIONS["BLUETOOTH_CONNECT"],
          this._permissionsAndroid.PERMISSIONS["ACCESS_FINE_LOCATION"],
        ]);

        this._isSupported = Maybe.of(
          result["android.permission.BLUETOOTH_CONNECT"] ===
            this._permissionsAndroid.RESULTS["GRANTED"] &&
            result["android.permission.BLUETOOTH_SCAN"] ===
              this._permissionsAndroid.RESULTS["GRANTED"] &&
            result["android.permission.ACCESS_FINE_LOCATION"] ===
              this._permissionsAndroid.RESULTS["GRANTED"],
        );

        return true;
      }
    }

    this._logger.error("Permission have not been granted", {
      data: { isSupported: this._isSupported.extract() },
    });

    this._isSupported = Maybe.of(false);
    return false;
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
    this._logger.debug("[RNBLE][_handleDeviceDisconnected]", {
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
    if (this._reconnectionSubscription.isJust()) {
      return;
    }

    Maybe.fromNullable(this._deviceConnectionsById.get(deviceId)).map(
      (deviceConnection) => deviceConnection.eventDeviceDetached(),
    );

    const reconnect$ = from([0]).pipe(
      switchMap(async () => {
        await this._stopScanning();
        await this._safeCancel(deviceId);
      }),
      switchMap(async () => {
        this._logger.debug(
          "[_handleDeviceDisconnected] reconnecting to device",
          { data: { id: device.id } },
        );
        const reconnectedDevice = await this._manager.connectToDevice(
          deviceId,
          { requestMTU: DEFAULT_MTU, timeout: 2000 },
        );
        this._logger.debug(
          "[_handleDeviceDisconnected] reconnected to device",
          { data: { id: device.id } },
        );
        const reconnectedDeviceUsable =
          await reconnectedDevice.discoverAllServicesAndCharacteristics();
        this._logger.debug(
          "[_handleDeviceDisconnected] discovered all services and characteristics",
          { data: { reconnectedDeviceUsable } },
        );
        await this._handleDeviceReconnected(reconnectedDeviceUsable);
        return reconnectedDeviceUsable;
      }),
      retry(5),
    );

    this._reconnectionSubscription = Maybe.of(
      reconnect$.subscribe({
        next: (d) =>
          this._logger.debug(
            "[_handleDeviceDisconnected] Reconnected to device",
            { data: { id: d.id } },
          ),
        complete: () => {
          this._reconnectionSubscription = Maybe.zero();
        },
        error: (e) => {
          this._logger.error(
            "[_handleDeviceDisconnected] All reconnection attempts failed",
            { data: { e } },
          );
          Maybe.fromNullable(this._deviceConnectionsById.get(deviceId)).map(
            (sm) => sm.closeConnection(),
          );
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
            "Error in mapping services UUIDs to Bluetooth device info",
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

      deviceConnectionStateMachine.eventDeviceAttached();
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
          await this._manager.cancelDeviceConnection(deviceId);
        }
      }
    }
  }
}

export const RNBleTransportFactory: TransportFactory = ({
  deviceModelDataSource,
  loggerServiceFactory,
  apduSenderServiceFactory,
  apduReceiverServiceFactory,
}) =>
  new RNBleTransport(
    deviceModelDataSource,
    loggerServiceFactory,
    apduSenderServiceFactory,
    apduReceiverServiceFactory,
    new BleManager(),
  );
