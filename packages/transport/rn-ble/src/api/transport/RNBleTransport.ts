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

  async stopDiscovering(): Promise<void> {
    await this._manager.stopDeviceScan();
  }

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
        // internalDevice.disconnectionSubscription.remove();
        internalDevice.disconnectionSubscription =
          this._manager.onDeviceDisconnected(internalDevice.id, (...args) => {
            this._handleDeviceDisconnected(...args);
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

  async disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    // if (internalDevice.disconnectionSubscription) {
    //   internalDevice.disconnectionSubscription.remove();
    // }
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

  listenToKnownDevices(): Observable<TransportDiscoveredDevice[]> {
    return from([]);
  }

  isSupported(): boolean {
    return this._isSupported.caseOf({
      Just: (isSupported) => isSupported,
      Nothing: () => {
        throw new Error("Should initialize permission");
      },
    });
  }

  getIdentifier(): TransportIdentifier {
    return this.identifier;
  }

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

  private _handleDeviceDisconnected(
    error: BleError | null,
    device: Device | null,
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
        switchMap(async () => {
          this._logger.info("new call subscriber next");
          try {
            await device.connect({ timeout: 800 });
            await device.discoverAllServicesAndCharacteristics();
            this._handleDeviceReconnected(device);
          } catch (e) {
            this._logger.error("Reconnecting failed", { data: { e } });
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
