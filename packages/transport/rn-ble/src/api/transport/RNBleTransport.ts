import { PermissionsAndroid, Platform } from "react-native";
import {
  type BleError,
  BleManager,
  type Device,
  type Subscription,
} from "react-native-ble-plx";
import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type BleDeviceInfos,
  type ConnectError,
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
  merge,
  Observable,
  retry,
  type Subscriber,
  switchMap,
} from "rxjs";

import { RNBleDeviceConnection } from "@api/transport/RNBleDeviceConnection";

type RNBleInternalDevice = {
  id: DeviceId;
  bleDeviceInfos: BleDeviceInfos;
  discoveredDevice: TransportDiscoveredDevice;
  disconnectionSubscription: Subscription;
  lastDiscoveredTimeStamp: Maybe<number>;
};

export const rnBleTransportIdentifier = "RN_BLE";

export class RNBleTransport implements Transport {
  private _logger: LoggerPublisherService;
  private _isSupported: Maybe<boolean>;
  private _internalDevicesById: Map<DeviceId, RNBleInternalDevice>;
  private _deviceConnectionsById: Map<DeviceId, RNBleDeviceConnection>;
  private readonly _manager: BleManager;
  private readonly identifier: TransportIdentifier = "RN_BLE";

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
    const ledgerUuids = this._deviceModelDataSource.getBluetoothServices();
    this._internalDevicesById.clear();
    return from(this.requestPermission()).pipe(
      switchMap((isSupported) => {
        if (!isSupported) {
          throw new Error("BLE not supported");
        }
        return merge(
          this._discoverKnownDevices(ledgerUuids),
          this._discoverNewDevices(ledgerUuids),
        );
      }),
    );
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
        try {
          await this._manager.connectToDevice(params.deviceId);
          await this._manager.discoverAllServicesAndCharacteristicsForDevice(
            params.deviceId,
          );
        } catch (error) {
          return throwE(new OpeningConnectionError(error));
        }
        const { serviceUuid, writeCmdUuid, notifyUuid } =
          internalDevice.bleDeviceInfos;
        const deviceConnection = new RNBleDeviceConnection(
          {
            onWrite: (value) =>
              this._manager.writeCharacteristicWithoutResponseForDevice(
                params.deviceId,
                serviceUuid,
                writeCmdUuid,
                value,
              ),
            apduSenderFactory: this._apduSenderFactory,
            apduReceiverFactory: this._apduReceiverFactory,
          },
          this._loggerServiceFactory,
        );
        this._manager.monitorCharacteristicForDevice(
          params.deviceId,
          serviceUuid,
          notifyUuid,
          (error, characteristic) => {
            if (!error && characteristic) {
              deviceConnection.onMonitor(characteristic);
            }
          },
        );
        await deviceConnection.setup();
        this._deviceConnectionsById.set(internalDevice.id, deviceConnection);
        internalDevice.disconnectionSubscription =
          this._manager.onDeviceDisconnected(internalDevice.id, (...args) => {
            this._handleDeviceDisconnected(...args, params.onDisconnect);
            // params.onDisconnect(internalDevice.id);
          });
        internalDevice.lastDiscoveredTimeStamp = Maybe.zero();
        return new TransportConnectedDevice({
          id: internalDevice.id,
          deviceModel: internalDevice.discoveredDevice.deviceModel,
          type: "BLE",
          sendApdu: (...args) => deviceConnection.sendApdu(...args),
          transport: this.identifier,
        });
      },
    ).run();
  }

  /**
   * Terminates the connection with the connected device and cleans up related resources.
   *
   * @param {Object} _params - The parameters for disconnecting the device.
   * @param {TransportConnectedDevice} _params.connectedDevice - The connected device to be disconnected.
   * @return {Promise<Either<DmkError, void>>} A promise resolving to either a success (void) or a failure (DmkError) value.
   */
  async disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    await this._manager.cancelDeviceConnection(_params.connectedDevice.id);
    this._deviceConnectionsById.delete(_params.connectedDevice.id);
    this._internalDevicesById.delete(_params.connectedDevice.id);
    return Right(void 0);
  }

  private _isDiscoveredDeviceLost(internalDevice: RNBleInternalDevice) {
    return internalDevice.lastDiscoveredTimeStamp.caseOf({
      Just: (lastDiscoveredTimeStamp) =>
        Date.now() > lastDiscoveredTimeStamp + 5000,
      Nothing: () => {
        internalDevice.lastDiscoveredTimeStamp = Maybe.of(Date.now());
        return true;
      },
    });
  }

  /**
   * Listens to known devices and emits updates when new devices are discovered or when properties of existing devices are updated.
   *
   * @return {Observable<TransportDiscoveredDevice[]>} An observable stream of discovered devices, containing device information as an array of TransportDiscoveredDevice objects.
   */
  listenToKnownDevices(): Observable<TransportDiscoveredDevice[]> {
    return from([]);
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
      return Nothing;
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
        };
        return {
          discoveredDevice,
          bleDeviceInfos,
        };
      });
    }, Nothing);
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
  private _handleLostDiscoveredDevices(
    subscriber: Subscriber<TransportDiscoveredDevice>,
  ) {
    this._internalDevicesById.forEach((internalDevice) => {
      if (this._isDiscoveredDeviceLost(internalDevice)) {
        this._internalDevicesById.delete(internalDevice.id);
        subscriber.next({
          ...internalDevice.discoveredDevice,
          available: false,
        });
      }
    });
  }

  /**
   * Emits a discovered device to the provided subscriber and manages internal state
   * for the discovered device, including handling its availability status and disconnection events.
   *
   * @param {Subscriber<TransportDiscoveredDevice>} subscriber The subscriber to emit the discovered device to.
   * @param {BleDeviceInfos} bleDeviceInfos The BLE device information associated with the discovered device.
   * @param {TransportDiscoveredDevice} discoveredDevice The newly discovered device to be emitted.
   * @return {void} Does*/
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
      available: true,
      lastDiscoveredTimeStamp: Maybe.of(Date.now()),
    };
    this._internalDevicesById.set(discoveredDevice.id, {
      ...internalDevice,
      disconnectionSubscription: this._manager.onDeviceDisconnected(
        discoveredDevice.id,
        () => {
          // this._internalDevicesById.delete(discoveredDevice.id);
          subscriber.next({ ...discoveredDevice, available: false });
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
        this._handleLostDiscoveredDevices(subscriber);

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
      });
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
            devices.forEach((device) => {
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
          }),
      ),
    );
  }

  /**
   * Handles the event when a Bluetooth device gets disconnected. This method attempts
   * to reconnect to the device, retries a certain number of times on failure, and
   * invokes a callback if the reconnection does not succeed.
   *
   * @param {BleError | null} error - The error object representing the reason for the disconnection, or null if no error occurred.
   * @param {Device | null} device - The Bluetooth device that was disconnected, or null if no device is provided.
   * @param {DisconnectHandler} onDisconnect - A callback function to be called if the reconnection attempts fail completely.
   * @return {void}
   */
  private _handleDeviceDisconnected(
    error: BleError | null,
    device: Device | null,
    onDisconnect: DisconnectHandler,
  ) {
    if (error) {
      this._logger.error("device disconnected error", {
        data: { error, device },
      });
    }
    if (!device) {
      this._logger.info("disconnected handler didn't found device");
      return;
    }
    this._logger.info("new disconnected handler");
    from([0])
      .pipe(
        switchMap(async (count) => {
          this._logger.info("new call subscriber next");
          try {
            await device.connect();
            await device.discoverAllServicesAndCharacteristics();
            this._handleDeviceReconnected(device);
          } catch (e) {
            this._logger.error("Reconnecting failed", { data: { e } });
            if (count === 4) {
              onDisconnect(device.id);
            }
          }
          return device;
        }),
        retry({
          count: 4,
          delay: 500,
        }),
      )
      .subscribe({
        next: (value) => this._logger.debug("value", { data: { value } }),
      });
  }

  /**
   * Handles the logic for when a device is reconnected.
   * This includes setting up the onWrite and monitoring behavior for the reconnected device.
   *
   * @param {Device} device - The device that has reconnected.
   * @return {void} This method does not return a value.
   */
  private _handleDeviceReconnected(device: Device) {
    const deviceConnection = this._deviceConnectionsById.get(
      device.id,
    ) as RNBleDeviceConnection;
    const internalDevice = this._internalDevicesById.get(
      device.id,
    ) as RNBleInternalDevice;
    deviceConnection.onWrite = (value) =>
      this._manager.writeCharacteristicWithoutResponseForDevice(
        device.id,
        internalDevice.bleDeviceInfos.serviceUuid,
        internalDevice.bleDeviceInfos.writeCmdUuid,
        value,
      );
    this._manager.monitorCharacteristicForDevice(
      device.id,
      internalDevice.bleDeviceInfos.serviceUuid,
      internalDevice.bleDeviceInfos.notifyUuid,
      (error, characteristic) => {
        if (!error && characteristic) {
          deviceConnection.onMonitor(characteristic);
        }
      },
    );
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
