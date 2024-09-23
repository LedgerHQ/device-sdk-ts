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
  private _internalDevicesById: Map<DeviceId, WebBleInternalDevice>;
  private _deviceConnectionById: Map<string, BleDeviceConnection>;
  private _disconnectionHandlersById: Map<string, () => void>;
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

  isSupported() {
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
          const deviceError = new NoAccessibleDeviceError(error);
          throw deviceError;
        }

        return bleDevice;
      })
      .run();
  }

  /**
   * Generate a discovered device from BluetoothDevice, BleGATT primary service and BLE device infos
   * @param bleDevice
   * @param bleGattService
   * @param bleDeviceInfos
   * @private
   */
  private getDiscoveredDeviceFrom(
    bleDevice: BluetoothDevice,
    bleGattService: BluetoothRemoteGATTService,
    bleDeviceInfos: BleDeviceInfos,
  ) {
    const id = uuid();

    const discoveredDevice = {
      id,
      deviceModel: bleDeviceInfos.deviceModel,
      transport: this.identifier,
    };

    const internalDevice: WebBleInternalDevice = {
      id,
      bleDevice,
      bleGattService,
      bleDeviceInfos,
      discoveredDevice,
    };

    this._logger.debug(
      `Discovered device ${id} ${discoveredDevice.deviceModel.productName}`,
    );
    this._internalDevicesById.set(id, internalDevice);

    return discoveredDevice;
  }

  /**
   * Main method to get a device from a button click handler
   * The GATT connection is done here in order to populate InternalDiscoveredDevice with deviceModel
   */
  startDiscovering(): Observable<InternalDiscoveredDevice> {
    this._logger.debug("startDiscovering");

    this._internalDevicesById.clear();

    return from(this.promptDeviceAccess()).pipe(
      switchMap(async (errorOrBleDevice) =>
        errorOrBleDevice.caseOf({
          Right: async (bleDevice) => {
            // ble connect here as gatt server needs to be opened to fetch gatt service
            if (bleDevice.gatt) {
              try {
                await bleDevice.gatt.connect();
              } catch (error) {
                throw new OpeningConnectionError(error);
              }
            }
            const errorOrBleGattService =
              await this.getBleGattService(bleDevice);
            return errorOrBleGattService.caseOf({
              Right: (bleGattService) => {
                const errorOrBleDeviceInfos =
                  this.getBleDeviceInfos(bleGattService);
                return errorOrBleDeviceInfos.caseOf({
                  Right: (bleDeviceInfos) =>
                    this.getDiscoveredDeviceFrom(
                      bleDevice,
                      bleGattService,
                      bleDeviceInfos,
                    ),
                  Left: (error) => {
                    throw error;
                  },
                });
              },
              Left: (error) => {
                throw error;
              },
            });
          },
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
      this._logger.error(`Unknown device ${deviceId}`);
      return Left(new UnknownDeviceError(`Unknown device ${deviceId}`));
    }

    const {
      discoveredDevice: { deviceModel },
    } = internalDevice;

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
    this._deviceConnectionById.set(internalDevice.id, deviceConnection);
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
    this._disconnectionHandlersById.set(internalDevice.id, () => {
      this.disconnect({ connectedDevice }).then(() => onDisconnect(deviceId));
    });
    return Right(connectedDevice);
  }

  private _getDeviceDisconnectedHandler(
    internalDevice: WebBleInternalDevice,
    deviceConnection: BleDeviceConnection,
  ) {
    return async () => {
      const disconnectObserver = timer(RECONNECT_DEVICE_TIMEOUT).subscribe(
        () => {
          const disconnectHandler = Maybe.fromNullable(
            this._disconnectionHandlersById.get(internalDevice.id),
          );
          disconnectHandler.map((handler) => {
            this._logger.info("timer over, disconnect device");
            handler();
          });
        },
      );
      await internalDevice.bleDevice.gatt?.connect();
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
        await deviceConnection.reconnect(writeC, notifyC);
        disconnectObserver.unsubscribe();
      }
    };
  }

  /**
   * Disconnect from a BLE device and delete its handlers
   *
   * @param connectedDevice InternalConnectedDevice
   */
  async disconnect(params: {
    connectedDevice: InternalConnectedDevice;
  }): Promise<Either<SdkError, void>> {
    const maybeInternalDevice = Maybe.fromNullable(
      this._internalDevicesById.get(params.connectedDevice.id),
    );

    if (maybeInternalDevice.isNothing()) {
      this._logger.error(`Unknown device ${params.connectedDevice.id}`);
      return Left(
        new UnknownDeviceError(`Unknown device ${params.connectedDevice.id}`),
      );
    }
    maybeInternalDevice.map((device) => {
      const { bleDevice } = device;
      const maybeDeviceConnection = Maybe.fromNullable(
        this._deviceConnectionById.get(device.id),
      );
      maybeDeviceConnection.map((dConnection) => dConnection.disconnect());
      bleDevice.gatt?.disconnect();
      this._internalDevicesById.delete(device.id);
      this._deviceConnectionById.delete(device.id);
      this._disconnectionHandlersById.delete(device.id);
    });

    return Right(void 0);
  }
}
