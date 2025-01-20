import { PermissionsAndroid, Platform } from "react-native";
import {
  type BleError,
  type Characteristic,
  type Device,
  type Device as RnBleDevice,
  type Subscription,
} from "react-native-ble-plx";
import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type BleDeviceInfos,
  type ConnectError,
  type DeviceId,
  type DeviceModelDataSource,
  DisconnectError,
  type DisconnectHandler,
  type DmkError,
  type LoggerPublisherService,
  OpeningConnectionError,
  ReconnectionFailedError,
  type Transport,
  TransportConnectedDevice,
  type TransportDiscoveredDevice,
  type TransportFactory,
  type TransportIdentifier,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { Either, EitherAsync, Left, Maybe, Nothing, Right } from "purify-ts";
import {
  concat,
  delay,
  from,
  Observable,
  retry,
  Subscriber,
  switchMap,
  throwError,
} from "rxjs";

import { BLEService } from "@api/transport/BleServiceInstance";
import { RNBleDeviceConnection } from "@api/transport/RNBleDeviceConnection";

type RNBleInternalDevice = {
  id: DeviceId;
  bleDevice: RnBleDevice;
  bleDeviceInfos: BleDeviceInfos;
  discoveredDevice: TransportDiscoveredDevice;
  disconnectionSubscription: Subscription;
  lastDiscoveredTimeStamp: Maybe<number>;
};

export const rnBleTransportIdentifier = "RN_BLE";

type DeviceCharacteristics = {
  notifyCharacteristic: Characteristic;
  writeCharacteristic: Characteristic;
};

export class RNBleTransport implements Transport {
  private _logger: LoggerPublisherService;
  private _isSupported: Maybe<boolean>;
  private _internalDevicesById: Map<DeviceId, RNBleInternalDevice>;
  private _deviceConnectionsById: Map<DeviceId, RNBleDeviceConnection>;
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
    this._isSupported = Maybe.zero();
    this._internalDevicesById = new Map();
    this._deviceConnectionsById = new Map();
    this.requestPermission();
  }

  private _isDiscoveredDeviceLost(internalDevice: RNBleInternalDevice) {
    return internalDevice.lastDiscoveredTimeStamp.caseOf({
      Just: (lastDiscoveredTimeStamp) =>
        Date.now() > lastDiscoveredTimeStamp + 10000,
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
      this._logger.debug("device already known", {
        data: {
          id: rnDevice.id,
          name: rnDevice.localName,
        },
      });
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
      this._logger.debug("discovered device lost ?", {
        data: {
          internalDevice,
          now: Date.now(),
          lost: this._isDiscoveredDeviceLost(internalDevice),
        },
      });
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
    bleDevice: Device,
  ) {
    subscriber.next(discoveredDevice);
    const internalDevice = {
      id: discoveredDevice.id,
      bleDeviceInfos,
      bleDevice: bleDevice,
      discoveredDevice,
      available: true,
      lastDiscoveredTimeStamp: Maybe.of(Date.now()),
    };
    this._internalDevicesById.set(discoveredDevice.id, {
      ...internalDevice,
      disconnectionSubscription: bleDevice.onDisconnected(() => {
        this._logger.debug("discovered device disconnected", {
          data: { discoveredDevice },
        });
        this._internalDevicesById.delete(discoveredDevice.id);
        subscriber.next({ ...discoveredDevice, available: false });
      }),
    });
  }

  private _discoverNewDevices(
    ledgerUuids: string[],
  ): Observable<TransportDiscoveredDevice> {
    return new Observable<TransportDiscoveredDevice>((subscriber) => {
      BLEService.manager.startDeviceScan(null, null, (error, device) => {
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
              device,
            );
          },
        );
      });
    });
  }
  private _discoverKnownDevices(
    ledgerUuids: string[],
  ): Observable<TransportDiscoveredDevice> {
    return from(BLEService.manager.connectedDevices(ledgerUuids)).pipe(
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
                    device,
                  );
                },
              );
            });
          }),
      ),
    );
  }
  startDiscovering(): Observable<TransportDiscoveredDevice> {
    const ledgerUuids = this._deviceModelDataSource.getBluetoothServices();
    this._logger.info("StartDiscovering", { data: { ledgerUuids } });
    this._internalDevicesById.clear();
    return from(this.requestPermission()).pipe(
      switchMap((isSupported) => {
        if (!isSupported) {
          throw new Error("BLE not supported");
        }
        return concat(
          this._discoverNewDevices(ledgerUuids),
          this._discoverKnownDevices(ledgerUuids),
        );
      }),
    );
  }

  async stopDiscovering(): Promise<void> {
    await BLEService.manager.stopDeviceScan();
  }

  private async _handleDeviceReconnected(device: Device) {
    await EitherAsync<ReconnectionFailedError | OpeningConnectionError, void>(
      async ({ liftEither }) => {
        const internalDevice = await liftEither(
          Maybe.fromNullable(
            this._internalDevicesById.get(device.id),
          ).toEither<ReconnectionFailedError>(
            new ReconnectionFailedError("Internal device not found"),
          ),
        );
        const deviceConnection = await liftEither(
          Maybe.fromNullable(
            this._deviceConnectionsById.get(device.id),
          ).toEither(
            new ReconnectionFailedError("Device connection not found"),
          ),
        );
        const { writeCharacteristic, notifyCharacteristic } = await liftEither(
          await this._getDeviceCharacteristics(
            device,
            internalDevice.bleDeviceInfos,
          ),
        );
        internalDevice.bleDevice = device;
        await deviceConnection.reconnect(
          writeCharacteristic,
          notifyCharacteristic,
        );
      },
    ).run();
  }

  private _handleDeviceDisconnected(error: BleError | null, device: Device) {
    if (error) {
      this._logger.error("device disconnected error", {
        data: { error, device },
      });
    }
    from([0])
      .pipe(
        switchMap(async (count) => {
          this._logger.debug("try reconnecting", { data: { count } });
          try {
            await this._handleDeviceReconnected(await device.connect());
            this._logger.debug("reconnected");
            return true;
          } catch (e) {
            throwError(() => e);
          }
          return false;
        }),
        delay(500),
        retry(4),
      )
      .subscribe((connected) => {
        this._logger.info("reconnecting", { data: { connected } });
      });
  }

  private async _getDeviceCharacteristics(
    device: Device,
    bleDeviceInfos: BleDeviceInfos,
  ): Promise<Either<OpeningConnectionError, DeviceCharacteristics>> {
    const characteristics = await device.characteristicsForService(
      bleDeviceInfos.serviceUuid,
    );
    const writeCharacteristic = characteristics.find(
      (c) => c.uuid === bleDeviceInfos.writeCmdUuid,
    );
    const notifyCharacteristic = characteristics.find(
      (c) => c.uuid === bleDeviceInfos.notifyUuid,
    );
    if (!notifyCharacteristic || !writeCharacteristic) {
      return Left(new OpeningConnectionError("Characteristics not found"));
    }
    return Right({ writeCharacteristic, notifyCharacteristic });
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
        let device = internalDevice.bleDevice;
        try {
          device = await device.connect();
          device = await device.discoverAllServicesAndCharacteristics();
        } catch (error) {
          return throwE(new OpeningConnectionError(error));
        }
        const { notifyCharacteristic, writeCharacteristic } = await liftEither(
          await this._getDeviceCharacteristics(
            device,
            internalDevice.bleDeviceInfos,
          ),
        );
        const deviceConnection = new RNBleDeviceConnection(
          {
            writeCharacteristic,
            notifyCharacteristic,
            apduSenderFactory: this._apduSenderFactory,
            apduReceiverFactory: this._apduReceiverFactory,
          },
          this._loggerServiceFactory,
        );
        await deviceConnection.setup();
        this._deviceConnectionsById.set(internalDevice.id, deviceConnection);
        internalDevice.disconnectionSubscription.remove();
        internalDevice.disconnectionSubscription = device.onDisconnected(
          (...args) => this._handleDeviceDisconnected(...args),
        );
        internalDevice.bleDevice = device;
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
  disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    return EitherAsync<DmkError, void>(async ({ liftEither }) => {
      const deviceConnection = await liftEither(
        Maybe.fromNullable(
          this._deviceConnectionsById.get(_params.connectedDevice.id),
        ).toEither(new DisconnectError("device connection not found")),
      );
      deviceConnection.disconnect();
      const internalDevice = await liftEither(
        Maybe.fromNullable(
          this._internalDevicesById.get(_params.connectedDevice.id),
        ).toEither(new OpeningConnectionError("Device not found")),
      );
      if (internalDevice.disconnectionSubscription) {
        internalDevice.disconnectionSubscription.remove();
      }
      await internalDevice.bleDevice.cancelConnection();
      this._deviceConnectionsById.delete(_params.connectedDevice.id);
      this._internalDevicesById.delete(_params.connectedDevice.id);
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
