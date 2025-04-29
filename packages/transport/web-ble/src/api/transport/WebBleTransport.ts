import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type BleDeviceInfos,
  type ConnectError,
  type ConnectionType,
  DeviceAlreadyConnectedError,
  type DeviceId,
  type DeviceModelDataSource,
  DeviceNotRecognizedError,
  type DisconnectHandler,
  type DmkError,
  type LoggerPublisherService,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  type Transport,
  TransportConnectedDevice,
  type TransportDiscoveredDevice,
  type TransportFactory,
  type TransportIdentifier,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { from, type Observable, switchMap, timer } from "rxjs";
import { v4 as uuid } from "uuid";

import {
  GET_HANDLER_BASE_DELAY_MS,
  GET_HANDLER_MAX_RETRIES,
  RECONNECT_DEVICE_TIMEOUT,
} from "@api/data/WebBleConfig";
import {
  BleDeviceGattServerError,
  BleTransportNotSupportedError,
} from "@api/model/Errors";
import { BleDeviceConnection } from "@api/transport/BleDeviceConnection";

type PromptDeviceAccessError =
  | NoAccessibleDeviceError
  | BleTransportNotSupportedError;

// An attempt to manage the state of several devices with one transport. Not final.
type WebBleInternalDevice = {
  id: DeviceId;
  bleDevice: BluetoothDevice;
  bleDeviceInfos: BleDeviceInfos;
  bleGattService: BluetoothRemoteGATTService;
  discoveredDevice: TransportDiscoveredDevice;
};

export const webBleIdentifier: TransportIdentifier = "WEB-BLE";

export class WebBleTransport implements Transport {
  private readonly _connectedDevices: Array<BluetoothDevice>;
  private readonly _internalDevicesById: Map<DeviceId, WebBleInternalDevice>;
  private _deviceConnectionById: Map<DeviceId, BleDeviceConnection>;
  private _disconnectionHandlersById: Map<DeviceId, () => void>;
  private _logger: LoggerPublisherService;
  private readonly connectionType: ConnectionType = "BLE";
  private readonly identifier: TransportIdentifier = webBleIdentifier;
  private _reconnecting = false;

  constructor(
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    private readonly _loggerServiceFactory: (
      tag: string,
    ) => LoggerPublisherService,
    private readonly _apduSenderFactory: ApduSenderServiceFactory,
    private readonly _apduReceiverFactory: ApduReceiverServiceFactory,
  ) {
    this._connectedDevices = [];
    this._internalDevicesById = new Map();
    this._deviceConnectionById = new Map();
    this._disconnectionHandlersById = new Map();
    this._logger = _loggerServiceFactory("WebBleTransport");
  }

  /**
   * Get the Bluetooth API if supported or error
   * @returns `Either<BleTransportNotSupportedError, Bluetooth>`
   */
  private getBluetoothApi(): Either<BleTransportNotSupportedError, Bluetooth> {
    if (this.isSupported()) {
      return Right(navigator.bluetooth);
    }

    return Left(new BleTransportNotSupportedError("WebBle not supported"));
  }

  isSupported(): boolean {
    try {
      const result = !!navigator?.bluetooth;
      return result;
    } catch {
      return false;
    }
  }

  getIdentifier(): TransportIdentifier {
    return this.identifier;
  }

  listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    return from([]);
  }

  /**
   * Get Bluetooth GATT Primary service that is used to get writeCharacteristic and notifyCharacteristic
   * @param bleDevice
   * @private
   */
  private async getBleGattService(
    bleDevice: BluetoothDevice,
  ): Promise<Either<BleDeviceGattServerError, BluetoothRemoteGATTService>> {
    if (!bleDevice.gatt) {
      return Left(new BleDeviceGattServerError("Device gatt not found"));
    }
    try {
      const [bleGattService] = await bleDevice.gatt.getPrimaryServices();
      if (!bleGattService) {
        return Left(
          new BleDeviceGattServerError("bluetooth service not found"),
        );
      }
      return Right(bleGattService);
    } catch (e) {
      return Left(new BleDeviceGattServerError(e));
    }
  }

  /**
   * BleDeviceInfos to map primary service uuid to device model & characteristics uuid
   * @param bleGattService
   * @private
   */
  private getBleDeviceInfos(
    bleGattService: BluetoothRemoteGATTService,
  ): Either<DeviceNotRecognizedError, BleDeviceInfos> {
    const serviceToBleInfos =
      this._deviceModelDataSource.getBluetoothServicesInfos();
    const bleDeviceInfos = serviceToBleInfos[bleGattService.uuid];

    if (!bleDeviceInfos) {
      this._logger.error(
        `Device not recognized: ${bleGattService.device.name}`,
      );
      return Left(
        new DeviceNotRecognizedError(
          `Device not recognized: ${bleGattService.device.name}`,
        ),
      );
    }
    return Right(bleDeviceInfos);
  }

  /**
   * Prompt device selection in navigator
   *
   * @private
   */
  private promptDeviceAccess(): EitherAsync<
    PromptDeviceAccessError,
    BluetoothDevice
  > {
    return EitherAsync(async ({ liftEither, throwE }) => {
      const bluetoothApi = await liftEither(this.getBluetoothApi());
      let bleDevice: BluetoothDevice;

      try {
        bleDevice = await bluetoothApi.requestDevice({
          filters: this._deviceModelDataSource
            .getBluetoothServices()
            .map((serviceUuid) => ({
              services: [serviceUuid],
            })),
        });
      } catch (error) {
        return throwE(new NoAccessibleDeviceError(error));
      }

      return bleDevice;
    });
  }

  /**
   * Generate a discovered device from BluetoothDevice, BleGATT primary service and BLE device infos
   * @param bleDeviceInfos
   * @private
   */
  private getDiscoveredDeviceFrom(
    bleDeviceInfos: BleDeviceInfos,
  ): TransportDiscoveredDevice {
    return {
      id: uuid(),
      deviceModel: bleDeviceInfos.deviceModel,
      transport: this.identifier,
    };
  }

  /**
   * Generate an InternalDevice from a unique id, a BluetoothDevice, BleGATT primary service and BLE device infos
   * @param discoveredDevice
   * @param bleDevice
   * @param bleDeviceInfos
   * @param bleGattService
   * @private
   */
  private setInternalDeviceFrom(
    discoveredDevice: TransportDiscoveredDevice,
    bleDevice: BluetoothDevice,
    bleDeviceInfos: BleDeviceInfos,
    bleGattService: BluetoothRemoteGATTService,
  ) {
    const internalDevice: WebBleInternalDevice = {
      id: discoveredDevice.id,
      bleDevice,
      bleGattService,
      bleDeviceInfos,
      discoveredDevice,
    };

    this._logger.debug(
      `Discovered device ${internalDevice.id} ${discoveredDevice.deviceModel.productName}`,
    );
    this._internalDevicesById.set(internalDevice.id, internalDevice);
  }

  /**
   * Main method to get a device from a button click handler
   * The GATT connection is done here in order to populate TransportDiscoveredDevice with deviceModel
   */
  startDiscovering(): Observable<TransportDiscoveredDevice> {
    this._logger.debug("startDiscovering");

    return from(this.promptDeviceAccess()).pipe(
      switchMap(async (errorOrBleDevice) =>
        EitherAsync(async ({ liftEither, fromPromise }) => {
          const bleDevice = await liftEither(errorOrBleDevice);
          if (bleDevice.gatt) {
            try {
              await bleDevice.gatt.connect();
            } catch (error) {
              throw new OpeningConnectionError(error);
            }
          }
          try {
            const bleGattService = await fromPromise(
              this.getBleGattService(bleDevice),
            );
            const bleDeviceInfos = await liftEither(
              this.getBleDeviceInfos(bleGattService),
            );
            const discoveredDevice =
              this.getDiscoveredDeviceFrom(bleDeviceInfos);
            this.setInternalDeviceFrom(
              discoveredDevice,
              bleDevice,
              bleDeviceInfos,
              bleGattService,
            );
            return discoveredDevice;
          } catch (error) {
            this._logger.error("Error while discovering device", {
              data: { error, bleDevice },
            });
            if (bleDevice.forget) {
              await bleDevice.forget();
            }
            throw error;
          }
        }).caseOf({
          Right: (discoveredDevice) => discoveredDevice,
          Left: (error) => {
            this._logger.error("Error while getting accessible device", {
              data: { error },
            });
            throw error;
          },
        }),
      ),
    );
  }

  stopDiscovering(): void {
    this._logger.debug("stopDiscovering");
  }

  /**
   * Connect to a BLE device and update the internal state of the associated device
   * Handle ondisconnect event on the device in order to try a reconnection
   */
  async connect({
    deviceId,
    onDisconnect,
  }: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    const internalDevice = this._internalDevicesById.get(deviceId);

    if (!internalDevice) {
      this._logger.error(`Unknown device ${deviceId}`, {
        data: { internalDevices: this._internalDevicesById },
      });
      this._logger.debug("Available devices", {
        data: { devices: this._internalDevicesById },
      });
      return Left(new UnknownDeviceError(`Unknown device ${deviceId}`));
    }
    // if device already connected, remove device id from internal state and remove error
    if (this._connectedDevices.includes(internalDevice.bleDevice)) {
      this._internalDevicesById.delete(deviceId);
      return Left(new DeviceAlreadyConnectedError("Device already connected"));
    }

    const {
      discoveredDevice: { deviceModel },
    } = internalDevice;

    try {
      const [writeCharacteristic, notifyCharacteristic] = await Promise.all([
        internalDevice.bleGattService.getCharacteristic(
          internalDevice.bleDeviceInfos.writeCmdUuid,
        ),
        internalDevice.bleGattService.getCharacteristic(
          internalDevice.bleDeviceInfos.notifyUuid,
        ),
      ]);

      const deviceConnection = new BleDeviceConnection(
        {
          writeCharacteristic,
          notifyCharacteristic,
          apduReceiverFactory: this._apduReceiverFactory,
          apduSenderFactory: this._apduSenderFactory,
        },
        this._loggerServiceFactory,
      );

      await deviceConnection.setup();

      const connectedDevice = new TransportConnectedDevice({
        sendApdu: (apdu, triggersDisconnection) =>
          deviceConnection.sendApdu(apdu, triggersDisconnection),
        deviceModel,
        id: deviceId,
        type: this.connectionType,
        transport: this.identifier,
      });

      internalDevice.bleDevice.ongattserverdisconnected =
        this._getDeviceDisconnectedHandler(internalDevice, deviceConnection);

      this._deviceConnectionById.set(internalDevice.id, deviceConnection);
      this._disconnectionHandlersById.set(internalDevice.id, () => {
        this.disconnect({ connectedDevice }).then(() => onDisconnect(deviceId));
      });

      this._connectedDevices.push(internalDevice.bleDevice);

      return Right(connectedDevice);
    } catch (error) {
      if (internalDevice.bleDevice.forget) {
        await internalDevice.bleDevice.forget();
      }

      this._internalDevicesById.delete(deviceId);

      this._logger.error("Error while getting characteristics", {
        data: { error },
      });

      return Left(new OpeningConnectionError(error));
    }
  }

  /**
   * Get the device disconnected handler
   * @param internalDevice WebBleInternalDevice
   * @param deviceConnection BleDeviceConnection
   * @returns async () => void
   * @private
   */
  private _getDeviceDisconnectedHandler(
    internalDevice: WebBleInternalDevice,
    deviceConnection: BleDeviceConnection,
  ) {
    return async () => {
      if (this._reconnecting) return;
      this._reconnecting = true;
      this._logger.debug("Device disconnected, starting reconnect attempts");

      // start a hard timeout in case all retries fail
      let didReconnect = false;
      const timeoutSub = timer(RECONNECT_DEVICE_TIMEOUT).subscribe(() => {
        if (!didReconnect) {
          this._logger.debug("Reconnection overall timeout, cleaning up");
          deviceConnection.disconnect();
          const handler = this._disconnectionHandlersById.get(
            internalDevice.id,
          );
          handler?.();
        }
        timeoutSub.unsubscribe();
      });

      for (
        let attempt = 1;
        attempt <= GET_HANDLER_MAX_RETRIES && !didReconnect;
        attempt++
      ) {
        try {
          this._logger.debug(`Reconnect attempt #${attempt}`);
          const gatt = internalDevice.bleDevice.gatt!;

          // @ts-expect-error gatt.connecting is not typed
          if (!gatt.connected && !gatt.connecting) {
            await gatt.connect();
          }
          if (!gatt.connected) {
            throw new Error("GATT.connect() did not yield connected");
          }

          // re-discover service & characteristics on fresh GATT
          const freshService = await gatt.getPrimaryService(
            internalDevice.bleDeviceInfos.serviceUuid,
          );
          internalDevice.bleGattService = freshService;

          // run handshake
          await deviceConnection.reconnect();

          didReconnect = true;
          this._logger.debug("Reconnected successfully");
        } catch (err) {
          this._logger.error(`Reconnect attempt #${attempt} failed`, {
            data: { err },
          });
          if (attempt < GET_HANDLER_MAX_RETRIES) {
            // back off before retrying
            const delay = GET_HANDLER_BASE_DELAY_MS * attempt;
            this._logger.debug(`Waiting ${delay}ms before next attempt`);
            await new Promise((res) => setTimeout(res, delay));
          }
        }
      }

      // if we got back, cancel the overall timeout and exit
      if (didReconnect) {
        timeoutSub.unsubscribe();
      } else {
        this._logger.debug("All reconnection attempts failed; final cleanup");
        const handler = this._disconnectionHandlersById.get(internalDevice.id);
        handler?.();
      }

      this._reconnecting = false;
    };
  }

  /**
   * Disconnect from a BLE device and delete its handlers
   *
   * @param params { connectedDevice: TransportConnectedDevice }
   */
  async disconnect(params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    // retrieve internal device
    const maybeInternalDevice = Maybe.fromNullable(
      this._internalDevicesById.get(params.connectedDevice.id),
    );

    this._logger.debug("disconnect device", {
      data: { connectedDevice: params.connectedDevice },
    });

    if (maybeInternalDevice.isNothing()) {
      this._logger.error(`Unknown device ${params.connectedDevice.id}`);

      return Promise.resolve(
        Left(
          new UnknownDeviceError(`Unknown device ${params.connectedDevice.id}`),
        ),
      );
    }

    maybeInternalDevice.map((device) => {
      const { bleDevice } = device;

      // retrieve device connection and disconnect it
      const maybeDeviceConnection = Maybe.fromNullable(
        this._deviceConnectionById.get(device.id),
      );

      // ensure proper cleanup of device connection
      maybeDeviceConnection.map((dConnection) => {
        dConnection.disconnect();
        // Remove the device connection from the map
        this._deviceConnectionById.delete(device.id);
      });

      // disconnect device gatt server
      if (bleDevice.gatt?.connected) {
        bleDevice.gatt.disconnect();
      }

      // remove any gattserverdisconnected handlers
      if (bleDevice.ongattserverdisconnected) {
        bleDevice.ongattserverdisconnected = () => {};
      }

      // clean up objects
      this._internalDevicesById.delete(device.id);
      this._disconnectionHandlersById.delete(device.id);

      if (this._connectedDevices.includes(bleDevice)) {
        const index = this._connectedDevices.indexOf(bleDevice);
        if (index !== -1) {
          this._connectedDevices.splice(index, 1);
        }
      }
    });

    return Promise.resolve(Right(undefined));
  }
}

export const webBleTransportFactory: TransportFactory = ({
  deviceModelDataSource,
  loggerServiceFactory,
  apduSenderServiceFactory,
  apduReceiverServiceFactory,
}) =>
  new WebBleTransport(
    deviceModelDataSource,
    loggerServiceFactory,
    apduSenderServiceFactory,
    apduReceiverServiceFactory,
  );
