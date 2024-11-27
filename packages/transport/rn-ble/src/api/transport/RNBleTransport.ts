import { PermissionsAndroid, Platform } from "react-native";
import { type Device, type Device as RnBleDevice } from "react-native-ble-plx";
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
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";
import { concat, from, Observable, switchMap } from "rxjs";

import { BLEService } from "@api/transport/BleServiceInstance";
import { RNBleDeviceConnection } from "@api/transport/RNBleDeviceConnection";

type RNBleInternalDevice = {
  id: DeviceId;
  bleDevice: RnBleDevice;
  bleDeviceInfos: BleDeviceInfos;
  discoveredDevice: TransportDiscoveredDevice;
};

export const rnBleTransportIdentifier = "RN_BLE";

export class RNBleTransport implements Transport {
  private _logger: LoggerPublisherService;
  private _isSupported: Maybe<boolean>;
  private _internalDevicesById: Map<DeviceId, RNBleInternalDevice>;
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
    this.requestPermission();
  }

  listenToKnownDevices(): Observable<TransportDiscoveredDevice[]> {
    throw new Error("Method not implemented.");
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
  ): Maybe<TransportDiscoveredDevice> {
    const maybeUuid = Maybe.fromNullable(
      rnDevice?.serviceUUIDs?.find((uuid) => ledgerUuids.includes(uuid)),
    );
    const alreadyDiscoveredDevice = this._internalDevicesById.get(rnDevice.id);
    if (alreadyDiscoveredDevice) {
      return Maybe.zero();
    }
    return maybeUuid.mapOrDefault((uuid) => {
      const serviceToBleInfos =
        this._deviceModelDataSource.getBluetoothServicesInfos();
      const maybeBleDeviceInfos = Maybe.fromNullable(serviceToBleInfos[uuid]);
      return maybeBleDeviceInfos.map((bleDeviceInfos) => {
        const discoveredDevice: TransportDiscoveredDevice = {
          id: rnDevice.id,
          deviceModel: bleDeviceInfos.deviceModel,
          transport: this.identifier,
        };
        this._logger.info("set device", {
          data: { id: rnDevice.id, discoveredDevice },
        });
        this._internalDevicesById.set(rnDevice.id, {
          id: rnDevice.id,
          bleDevice: rnDevice,
          bleDeviceInfos,
          discoveredDevice: discoveredDevice,
        });
        return discoveredDevice;
      });
    }, Nothing);
  }

  private _discoverNewDevices(
    ledgerUuids: string[],
  ): Observable<TransportDiscoveredDevice> {
    return new Observable<TransportDiscoveredDevice>((subscriber) => {
      BLEService.manager.startDeviceScan(null, null, (error, device) => {
        if (error || !device) {
          subscriber.error(error);
          return;
        }
        this._getDiscoveredDeviceFrom(device, ledgerUuids).map(
          (discoveredDevice) => subscriber.next(discoveredDevice),
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
                (discoveredDevice) => subscriber.next(discoveredDevice),
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
    this._logger.info("stop discovering");
    await BLEService.manager.stopDeviceScan();
  }
  async connect(params: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    this._logger.info("connect to device", {
      data: {
        deviceId: params.deviceId,
        internalDevice: this._internalDevicesById.keys(),
      },
    });
    const internalDevice = this._internalDevicesById.get(params.deviceId);
    if (!internalDevice) {
      return Promise.resolve(
        Left(new UnknownDeviceError(`Unknown device ${params.deviceId}`)),
      );
    }
    const { bleDeviceInfos } = internalDevice;
    let device = internalDevice.bleDevice;
    try {
      device = await device.connect();
      device = await device.discoverAllServicesAndCharacteristics();
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
      return Right(
        new TransportConnectedDevice({
          id: internalDevice.id,
          deviceModel: internalDevice.discoveredDevice.deviceModel,
          type: "BLE",
          sendApdu: (...args) => deviceConnection.sendApdu(...args),
          transport: this.identifier,
        }),
      );
    } catch (error) {
      return Left(new OpeningConnectionError(error));
    }
  }
  disconnect(_params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    const maybeInternalDevice = Maybe.fromNullable(
      this._internalDevicesById.get(_params.connectedDevice.id),
    );
    return maybeInternalDevice.mapOrDefault(
      async (internalDevice) => {
        await internalDevice.bleDevice.cancelConnection();
        return Right(void 0);
      },
      Promise.resolve(Left(new OpeningConnectionError("Device not found"))),
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
