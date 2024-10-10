import { inject, injectable } from "inversify";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { from, Observable, switchMap, timer } from "rxjs";
import { v4 as uuid } from "uuid";

import { DeviceId } from "@api/device/DeviceModel";
import { ConnectionType } from "@api/discovery/ConnectionType";
import { SdkError } from "@api/Error";
import { Transport } from "@api/transport/model/Transport";
import {
  BuiltinTransports,
  TransportIdentifier,
} from "@api/transport/model/TransportIdentifier";
import type { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { deviceModelTypes } from "@internal/device-model/di/deviceModelTypes";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { bleDiTypes } from "@internal/transport/ble/di/bleDiTypes";
import { BleDeviceInfos } from "@internal/transport/ble/model/BleDeviceInfos";
import { BleDeviceConnectionFactory } from "@internal/transport/ble/service/BleDeviceConnectionFactory";
import { BleDeviceConnection } from "@internal/transport/ble/transport/BleDeviceConnection";
import { DisconnectHandler } from "@internal/transport/model/DeviceConnection";
import {
  BleDeviceGattServerError,
  BleTransportNotSupportedError,
  ConnectError,
  DeviceAlreadyConnectedError,
  DeviceNotRecognizedError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  type PromptDeviceAccessError,
  UnknownDeviceError,
} from "@internal/transport/model/Errors";
import { InternalConnectedDevice } from "@internal/transport/model/InternalConnectedDevice";
import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";
import { RECONNECT_DEVICE_TIMEOUT } from "@internal/transport/usb/data/UsbHidConfig";

// An attempt to manage the state of several devices with one transport. Not final.
type WebBleInternalDevice = {
  id: DeviceId;
  bleDevice: BluetoothDevice;
  bleDeviceInfos: BleDeviceInfos;
  bleGattService: BluetoothRemoteGATTService;
  discoveredDevice: InternalDiscoveredDevice;
};

@injectable()
export class WebBleTransport implements Transport {
  private _connectedDevices: Array<BluetoothDevice>;
  private _internalDevicesById: Map<DeviceId, WebBleInternalDevice>;
  private _deviceConnectionById: Map<DeviceId, BleDeviceConnection>;
  private _disconnectionHandlersById: Map<DeviceId, () => void>;
  private _logger: LoggerPublisherService;
  private readonly connectionType: ConnectionType = "BLE";
  private readonly identifier: TransportIdentifier = BuiltinTransports.BLE;

  constructor(
    @inject(deviceModelTypes.DeviceModelDataSource)
    private _deviceModelDataSource: DeviceModelDataSource,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
    @inject(bleDiTypes.BleDeviceConnectionFactory)
    private _bleDeviceConnectionFactory: BleDeviceConnectionFactory,
  ) {
    this._connectedDevices = [];
    this._internalDevicesById = new Map();
    this._deviceConnectionById = new Map();
    this._disconnectionHandlersById = new Map();
    this._logger = loggerServiceFactory("WebBleTransport");
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
  private async promptDeviceAccess(): Promise<
    Either<PromptDeviceAccessError, BluetoothDevice>
  > {
    return EitherAsync.liftEither(this.getBluetoothApi())
      .map(async (bluetoothApi) => {
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
          throw new NoAccessibleDeviceError(error);
        }

        return bleDevice;
      })
      .run();
  }

  /**
   * Generate a discovered device from BluetoothDevice, BleGATT primary service and BLE device infos
   * @param bleDeviceInfos
   * @private
   */
  private getDiscoveredDeviceFrom(
    bleDeviceInfos: BleDeviceInfos,
  ): InternalDiscoveredDevice {
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
    discoveredDevice: InternalDiscoveredDevice,
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
   * The GATT connection is done here in order to populate InternalDiscoveredDevice with deviceModel
   */
  startDiscovering(): Observable<InternalDiscoveredDevice> {
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
            await bleDevice.forget();
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
  }): Promise<Either<ConnectError, InternalConnectedDevice>> {
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
          internalDevice.bleDeviceInfos.writeUuid,
        ),
        internalDevice.bleGattService.getCharacteristic(
          internalDevice.bleDeviceInfos.notifyUuid,
        ),
      ]);
      const deviceConnection = this._bleDeviceConnectionFactory.create(
        writeCharacteristic,
        notifyCharacteristic,
      );
      await deviceConnection.setup();
      const connectedDevice = new InternalConnectedDevice({
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
      await internalDevice.bleDevice.forget();
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
      // start a timer to disconnect the device if it does not reconnect
      const disconnectObserver = timer(RECONNECT_DEVICE_TIMEOUT).subscribe(
        () => {
          this._logger.debug("disconnection timer over");
          // retrieve the disconnect handler and call it
          const disconnectHandler = Maybe.fromNullable(
            this._disconnectionHandlersById.get(internalDevice.id),
          );
          disconnectHandler.map((handler) => handler());
        },
      );
      // connect to the navigator device
      await internalDevice.bleDevice.gatt?.connect();
      // cancel disconnection timeout
      disconnectObserver.unsubscribe();
      // retrieve new ble characteristics
      const service = await this.getBleGattService(internalDevice.bleDevice);
      if (service.isRight()) {
        const [writeC, notifyC] = await Promise.all([
          service
            .extract()
            .getCharacteristic(internalDevice.bleDeviceInfos.writeUuid),
          service
            .extract()
            .getCharacteristic(internalDevice.bleDeviceInfos.notifyUuid),
        ]);
        // reconnect device connection
        await deviceConnection.reconnect(writeC, notifyC);
      }
    };
  }

  /**
   * Disconnect from a BLE device and delete its handlers
   *
   * @param params { connectedDevice: InternalConnectedDevice }
   */
  async disconnect(params: {
    connectedDevice: InternalConnectedDevice;
  }): Promise<Either<SdkError, void>> {
    // retrieve internal device
    const maybeInternalDevice = Maybe.fromNullable(
      this._internalDevicesById.get(params.connectedDevice.id),
    );
    this._logger.debug("disconnect device", {
      data: { connectedDevice: params.connectedDevice },
    });

    if (maybeInternalDevice.isNothing()) {
      this._logger.error(`Unknown device ${params.connectedDevice.id}`);
      return Left(
        new UnknownDeviceError(`Unknown device ${params.connectedDevice.id}`),
      );
    }
    maybeInternalDevice.map((device) => {
      const { bleDevice } = device;
      // retrieve device connection and disconnect it
      const maybeDeviceConnection = Maybe.fromNullable(
        this._deviceConnectionById.get(device.id),
      );
      maybeDeviceConnection.map((dConnection) => dConnection.disconnect());
      // disconnect device gatt server
      if (bleDevice.gatt?.connected) {
        bleDevice.gatt.disconnect();
      }
      // clean up objects
      this._internalDevicesById.delete(device.id);
      this._deviceConnectionById.delete(device.id);
      this._disconnectionHandlersById.delete(device.id);
      if (this._connectedDevices.includes(bleDevice)) {
        delete this._connectedDevices[
          this._connectedDevices.indexOf(bleDevice)
        ];
      }
    });

    return Right(void 0);
  }
}
