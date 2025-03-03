import { PermissionsAndroid, Platform } from "react-native";
import { type BleError, BleManager, type Device } from "react-native-ble-plx";
import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type BleDeviceInfos,
  type ConnectError,
  DeviceConnectionStateMachine,
  type DeviceId,
  type DeviceModelDataSource,
  type DisconnectHandler,
  type DmkError,
  type LoggerPublisherService,
  OpeningConnectionError,
  type Transport,
  TransportConnectedDevice,
  type TransportDiscoveredDevice,
  type TransportFactory,
  type TransportIdentifier,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Maybe, Nothing, Right } from "purify-ts";
import {
  from,
  map,
  mergeWith,
  Observable,
  repeat,
  retry,
  type Subscriber,
  type Subscription,
  switchMap,
  throwError,
} from "rxjs";

import {
  BLE_DISCONNECT_TIMEOUT,
  CONNECTION_LOST_DELAY,
  DEFAULT_MTU,
} from "@api/model/Const";
import {
  DeviceConnectionNotFound,
  InternalDeviceNotFound,
} from "@api/model/Errors";
import {
  RNBleApduSender,
  type RNBleApduSenderDependencies,
  type RNBleInternalDevice,
} from "@api/transport/RNBleApduSender";

export const rnBleTransportIdentifier = "RN_BLE";

export class RNBleTransport implements Transport {
  private _logger: LoggerPublisherService;
  private _isSupported: Maybe<boolean>;
  private _internalDevicesById: Map<DeviceId, RNBleInternalDevice>;
  private _deviceConnectionsById: Map<
    DeviceId,
    DeviceConnectionStateMachine<RNBleApduSenderDependencies>
  >;
  private readonly _manager: BleManager;
  private readonly identifier: TransportIdentifier = "RN_BLE";
  private _reconnectionSubscription: Maybe<Subscription>;

  constructor(
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    private readonly _loggerServiceFactory: (
      tag: string,
    ) => LoggerPublisherService,
    private readonly _apduSenderFactory: ApduSenderServiceFactory,
    private readonly _apduReceiverFactory: ApduReceiverServiceFactory,
  ) {
    this._logger = _loggerServiceFactory("ReactNativeBleTransport");
    this._manager = new BleManager();
    this._isSupported = Maybe.zero();
    this._internalDevicesById = new Map();
    this._deviceConnectionsById = new Map();
    this.requestPermission();
    this._reconnectionSubscription = Maybe.zero();
  }

  private _startDiscovering() {
    const ledgerUuids = this._deviceModelDataSource.getBluetoothServices();
    return from(this.requestPermission()).pipe(
      switchMap((isSupported) => {
        if (!isSupported) {
          throw new Error("BLE not supported");
        }
        return this._discoverKnownDevices(ledgerUuids);
      }),
      mergeWith(this._discoverNewDevices(ledgerUuids)),
    );
  }

  /**
   * Starts the discovery process to find Bluetooth devices that match specific criteria.
   *
   * This method clears the internal device cache and requests necessary permissions
   * before initiating the discovery of both known and new devices. If the Bluetooth
   * Low Energy (BLE) feature is not supported, an error is thrown.
   *
   * @return {Observable<TransportDiscoveredDevice>} An observable emitting discovered devices
   * that match the specified Bluetooth services.
   */
  startDiscovering(): Observable<TransportDiscoveredDevice> {
    return this._startDiscovering();
  }

  /**
   * Stops the device scanning operation currently in progress.
   *
   * @return {Promise<void>} A promise that resolves once the device scanning has been successfully stopped.
   */
  async stopDiscovering(): Promise<void> {
    await this._manager.stopDeviceScan();
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
    return EitherAsync<ConnectError, TransportConnectedDevice>(
      async ({ liftEither, throwE }) => {
        const internalDevice = await liftEither(
          Maybe.fromNullable(
            this._internalDevicesById.get(params.deviceId),
          ).toEither(
            new UnknownDeviceError(`Unknown device ${params.deviceId}`),
          ),
        );

        let device: Device;

        try {
          device = await this._manager.connectToDevice(params.deviceId, {
            requestMTU: DEFAULT_MTU,
          });
          await this._manager.discoverAllServicesAndCharacteristicsForDevice(
            params.deviceId,
          );
        } catch (error) {
          return throwE(new OpeningConnectionError(error));
        }

        const deviceApduSender = new RNBleApduSender(
          {
            apduSenderFactory: this._apduSenderFactory,
            apduReceiverFactory: this._apduReceiverFactory,
            dependencies: {
              device,
              internalDevice,
              manager: this._manager,
            },
          },
          this._loggerServiceFactory,
        );

        const deviceConnectionStateMachine =
          new DeviceConnectionStateMachine<RNBleApduSenderDependencies>({
            deviceId: params.deviceId,
            deviceApduSender,
            timeoutDuration: BLE_DISCONNECT_TIMEOUT,
            onTerminated: () => {
              params.onDisconnect(params.deviceId);
              this._deviceConnectionsById.delete(params.deviceId);
              const iDevice = this._internalDevicesById.get(params.deviceId);

              if (iDevice) {
                iDevice.disconnectionSubscription.remove();
              }

              this._internalDevicesById.delete(params.deviceId);
            },
          });

        await deviceApduSender.setupConnection();

        this._deviceConnectionsById.set(
          internalDevice.id,
          deviceConnectionStateMachine,
        );

        internalDevice.disconnectionSubscription =
          this._manager.onDeviceDisconnected(internalDevice.id, (...args) => {
            this._handleDeviceDisconnected(...args);
          });

        internalDevice.lastDiscoveredTimeStamp = Maybe.zero();

        return new TransportConnectedDevice({
          id: internalDevice.id,
          deviceModel: internalDevice.discoveredDevice.deviceModel,
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
    const deviceConnection = Maybe.fromNullable(
      this._deviceConnectionsById.get(params.connectedDevice.id),
    );

    deviceConnection.map((d) => {
      d.closeConnection();
    });

    return Promise.resolve(Right(undefined));
  }

  /**
   * Listens to known devices and emits updates when new devices are discovered or when properties of existing devices are updated.
   *
   * @return {Observable<TransportDiscoveredDevice[]>} An observable stream of discovered devices, containing device information as an array of TransportDiscoveredDevice objects.
   */
  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    const scannedDeviceMap: Record<DeviceId, TransportDiscoveredDevice> = {};
    return this._startDiscovering().pipe(
      map((discoveredDevice) => {
        scannedDeviceMap[discoveredDevice.id] = discoveredDevice;
        return Object.values(scannedDeviceMap).filter(
          (device) => device.rssi !== null,
        );
      }),
    );
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
    if (Platform.OS === "ios") {
      this._isSupported = Maybe.of(true);
      return true;
    }

    if (
      Platform.OS === "android" &&
      PermissionsAndroid.PERMISSIONS["ACCESS_FINE_LOCATION"]
    ) {
      const apiLevel = parseInt(Platform.Version.toString(), 10);

      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS["ACCESS_FINE_LOCATION"],
        );
        this._isSupported = Maybe.of(
          granted === PermissionsAndroid.RESULTS["GRANTED"],
        );
      }
      if (
        PermissionsAndroid.PERMISSIONS["BLUETOOTH_SCAN"] &&
        PermissionsAndroid.PERMISSIONS["BLUETOOTH_CONNECT"]
      ) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS["BLUETOOTH_SCAN"],
          PermissionsAndroid.PERMISSIONS["BLUETOOTH_CONNECT"],
          PermissionsAndroid.PERMISSIONS["ACCESS_FINE_LOCATION"],
        ]);

        this._isSupported = Maybe.of(
          result["android.permission.BLUETOOTH_CONNECT"] ===
            PermissionsAndroid.RESULTS["GRANTED"] &&
            result["android.permission.BLUETOOTH_SCAN"] ===
              PermissionsAndroid.RESULTS["GRANTED"] &&
            result["android.permission.ACCESS_FINE_LOCATION"] ===
              PermissionsAndroid.RESULTS["GRANTED"],
        );

        return true;
      }
    }

    this._logger.error("Permission have not been granted", {
      data: { isSupported: this.isSupported() },
    });

    this._isSupported = Maybe.of(false);
    return false;
  }

  /**
   * Retrieves a discovered device and its BLE device information, if available, from the provided input.
   *
   * @param {Device} rnDevice - The Bluetooth device to analyze for discovery.
   * @param {string[]} ledgerUuids - A list of UUIDs associated with the target Ledger devices.
   * @return {Maybe<{ bleDeviceInfos: BleDeviceInfos; discoveredDevice: TransportDiscoveredDevice }>} A Maybe object containing the discovered device and its BLE information, or Nothing if the device or information cannot be determined.
   */
  private _getDiscoveredDeviceFrom(
    rnDevice: Device,
    ledgerUuids: string[],
  ): Maybe<{
    bleDeviceInfos: BleDeviceInfos;
    discoveredDevice: TransportDiscoveredDevice;
  }> {
    const maybeUuid = Maybe.fromNullable(
      rnDevice?.serviceUUIDs?.find((uuid) => ledgerUuids.includes(uuid)),
    );

    const existingInternalDevice = Maybe.fromNullable(
      this._internalDevicesById.get(rnDevice.id),
    );

    if (existingInternalDevice.isJust()) {
      return existingInternalDevice.map((internalDevice) => ({
        bleDeviceInfos: internalDevice.bleDeviceInfos,
        discoveredDevice: {
          ...internalDevice.discoveredDevice,
          rssi: rnDevice.rssi || undefined,
        },
      }));
    }

    return maybeUuid.mapOrDefault((uuid) => {
      const serviceToBleInfos =
        this._deviceModelDataSource.getBluetoothServicesInfos();
      const maybeBleDeviceInfos = Maybe.fromNullable(serviceToBleInfos[uuid]);

      return maybeBleDeviceInfos.map((bleDeviceInfos) => {
        const discoveredDevice: TransportDiscoveredDevice = {
          id: rnDevice.id,
          name: rnDevice.localName || bleDeviceInfos.deviceModel.productName,
          deviceModel: bleDeviceInfos.deviceModel,
          transport: this.identifier,
          rssi: rnDevice.rssi || undefined,
        };

        return {
          discoveredDevice,
          bleDeviceInfos,
        };
      });
    }, Nothing);
  }

  /**
   * Determines whether the delay since the device was last discovered has exceeded a predefined threshold.
   *
   * @param {RNBleInternalDevice} internalDevice - The internal device object containing the last discovered timestamp.
   * @return {boolean} - Returns true if the delay is over, otherwise false.
   */
  private _isDiscoveredDeviceDelayOver(internalDevice: RNBleInternalDevice) {
    return internalDevice.lastDiscoveredTimeStamp.caseOf({
      Just: (lastDiscoveredTimeStamp) =>
        Date.now() > lastDiscoveredTimeStamp + CONNECTION_LOST_DELAY,
      Nothing: () => {
        return false;
      },
    });
  }

  /**
   * Handles the processing of devices that have been determined to be "lost" by iterating
   * through a collection of internal devices, identifying lost devices, updating their status,
   * and notifying a subscriber about the change.
   *
   * @param {Subscriber<TransportDiscoveredDevice>} subscriber - The observer that will be notified
   *     when a device is marked as lost, including updated device information with its availability set to false.
   * @return {void} This method does not return a value.
   */
  private async _handleLostDiscoveredDevices(
    subscriber: Subscriber<TransportDiscoveredDevice>,
  ) {
    const promises = this._internalDevicesById
      .values()
      .map((internalDevice) => async () => {
        if (
          this._isDiscoveredDeviceDelayOver(internalDevice) &&
          !(await this._manager.isDeviceConnected(internalDevice.id))
        ) {
          this._internalDevicesById.delete(internalDevice.id);
          subscriber.next({
            ...internalDevice.discoveredDevice,
            rssi: null,
          });
        }
      });
    await Promise.all(promises);
  }

  /**
   * Emits a discovered device to the provided subscriber and manages internal state
   * for the discovered device, including handling its availability status and disconnection events.
   *
   * @param {Subscriber<TransportDiscoveredDevice>} subscriber The subscriber to emit the discovered device to.
   * @param {BleDeviceInfos} bleDeviceInfos The BLE device information associated with the discovered device.
   * @param {TransportDiscoveredDevice} discoveredDevice The newly discovered device to be emitted.
   * @return {void} */
  private _emitDiscoveredDevice(
    subscriber: Subscriber<TransportDiscoveredDevice>,
    bleDeviceInfos: BleDeviceInfos,
    discoveredDevice: TransportDiscoveredDevice,
  ) {
    subscriber.next(discoveredDevice);
    const internalDevice = {
      id: discoveredDevice.id,
      bleDeviceInfos,
      discoveredDevice,
      lastDiscoveredTimeStamp: Maybe.of(Date.now()),
    };
    this._internalDevicesById.set(discoveredDevice.id, {
      ...internalDevice,
      disconnectionSubscription: this._manager.onDeviceDisconnected(
        discoveredDevice.id,
        () => {
          subscriber.next({
            ...discoveredDevice,
            rssi: null,
          });
        },
      ),
    });
  }

  /**
   * Discovers new devices by scanning for BLE devices and filtering them based on the provided ledger UUIDs.
   *
   * @param {string[]} ledgerUuids - An array of UUIDs used to identify relevant ledger devices.
   * @return {Observable<TransportDiscoveredDevice>} An observable that emits discovered devices matching the provided UUIDs.
   */
  private _discoverNewDevices(
    ledgerUuids: string[],
  ): Observable<TransportDiscoveredDevice> {
    return new Observable<TransportDiscoveredDevice>((subscriber) => {
      this._manager.startDeviceScan(null, null, (error, device) => {
        if (error || !device) {
          subscriber.error(error);
          return;
        }

        this._getDiscoveredDeviceFrom(device, ledgerUuids).map(
          ({ discoveredDevice, bleDeviceInfos }) => {
            this._emitDiscoveredDevice(
              subscriber,
              bleDeviceInfos,
              discoveredDevice,
            );
          },
        );
        this._handleLostDiscoveredDevices(subscriber);
      });
      return {
        unsubscribe: async () => {
          await this._manager.stopDeviceScan();
          subscriber.unsubscribe();
        },
      };
    });
  }

  /**
   * Discovers and emits known ledger devices based on the provided UUIDs.
   *
   * @param {string[]} ledgerUuids - An array of UUIDs representing the target ledger devices to discover.
   * @return {Observable<TransportDiscoveredDevice>} An Observable that emits discovered devices matching the provided UUIDs.
   */
  private _discoverKnownDevices(
    ledgerUuids: string[],
  ): Observable<TransportDiscoveredDevice> {
    return from(this._manager.connectedDevices(ledgerUuids)).pipe(
      switchMap(
        (devices) =>
          new Observable<TransportDiscoveredDevice>((subscriber) => {
            for (const fromDevice of devices) {
              fromDevice.readRSSI().then((device) => {
                this._getDiscoveredDeviceFrom(device, ledgerUuids).map(
                  ({ bleDeviceInfos, discoveredDevice }) => {
                    this._emitDiscoveredDevice(
                      subscriber,
                      bleDeviceInfos,
                      discoveredDevice,
                    );
                  },
                );
              });
            }
          }),
      ),
      repeat({ delay: BLE_DISCONNECT_TIMEOUT / 5 }),
    );
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
    if (error) {
      this._logger.error("device disconnected error", {
        data: { error, device },
      });
      return;
    }

    if (!device) {
      this._logger.debug("disconnected handler didn't found device");
      return;
    }

    if (this._reconnectionSubscription.isJust()) {
      return;
    }

    const errorOrDeviceConnection = Maybe.fromNullable(
      this._deviceConnectionsById.get(device.id),
    );

    errorOrDeviceConnection.map((deviceConnection) => {
      deviceConnection.eventDeviceDetached();
    });

    let reconnectedDevice: Device;

    this._reconnectionSubscription = Maybe.of(
      from([0])
        .pipe(
          switchMap(async () => {
            try {
              reconnectedDevice = await device.connect({
                requestMTU: DEFAULT_MTU,
              });
              reconnectedDevice =
                await device.discoverAllServicesAndCharacteristics();
              await this._handleDeviceReconnected(reconnectedDevice);
            } catch (e) {
              this._logger.error(
                "[_handleDeviceDisconnected] Reconnecting failed",
                { data: { e } },
              );

              throwError(() => e);
              return;
            }
            return reconnectedDevice;
          }),
          retry({
            count: 5,
            delay: BLE_DISCONNECT_TIMEOUT / 5,
          }),
        )
        .subscribe({
          next: (value) =>
            this._logger.debug(
              "[_handleDeviceDisconnected] Got new device after reconnection",
              { data: { value } },
            ),
          complete: () => {
            this._reconnectionSubscription = Maybe.zero();
          },
          error: (e) => {
            this._logger.error(
              "[_handleDeviceDisconnected] Reconnection failed after all retries",
              { data: { e } },
            );
            this._reconnectionSubscription = Maybe.zero();
            errorOrDeviceConnection.map((deviceConnection) => {
              deviceConnection.closeConnection();
            });
          },
        }),
    );
  }

  /**
   * Handles the reconnection of a device. Configures the device connection and its corresponding
   * internal device upon reconnection, including updating the connection state, registering
   * callbacks for write and monitor operations, and initiating a reconnect operation.
   *
   * @param {Device} device - The device object that has been reconnected. Contains device details,
   *                          such as the device ID.
   * @return {Promise<Either<DeviceConnectionNotFound | InternalDeviceNotFound, void>>} A promise that completes when the device reconnection has been fully
   *                         configured. Resolves with no value or rejects if an error occurs during
   *                         the reconnection process.
   */
  private async _handleDeviceReconnected(device: Device) {
    const errorOrDeviceConnection = Maybe.fromNullable(
      this._deviceConnectionsById.get(device.id),
    ).toEither(new DeviceConnectionNotFound());

    const errorOrInternalDevice = Maybe.fromNullable(
      this._internalDevicesById.get(device.id),
    ).toEither(new InternalDeviceNotFound());

    return EitherAsync(async ({ liftEither }) => {
      const deviceConnectionStateMachine = await liftEither(
        errorOrDeviceConnection,
      );

      const internalDevice = await liftEither(errorOrInternalDevice);

      deviceConnectionStateMachine.setDependencies({
        device,
        manager: this._manager,
        internalDevice,
      });

      await deviceConnectionStateMachine.setupConnection();

      deviceConnectionStateMachine.eventDeviceAttached();
    }).run();
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
  );
