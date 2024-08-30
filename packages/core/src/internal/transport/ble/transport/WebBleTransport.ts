import { inject, injectable } from "inversify";
import { Either, EitherAsync, Left, Right } from "purify-ts";
import { from, Observable, switchMap } from "rxjs";
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
  // Maps uncoupled DiscoveredDevice and WebHID's HIDDevice WebHID
  private _internalDevicesById: Map<DeviceId, WebBleInternalDevice>;
  private _deviceConnectionById: Map<string, BleDeviceConnection>;
  private _disconnectionHandlersById: Map<string, DisconnectHandler>;
  private _connectionListenersAbortController: AbortController;
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
    this._connectionListenersAbortController = new AbortController();
    this._logger = loggerServiceFactory("WebUsbHidTransport");
  }

  /**
   * Get the Bluetooth API if supported or error
   * @returns `Either<BleTransportNotSupportedError, Bluetooth>`
   */
  private get bluetoothApi(): Either<BleTransportNotSupportedError, Bluetooth> {
    if (this.isSupported()) {
      return Right(navigator.bluetooth);
    }

    return Left(new BleTransportNotSupportedError("WebHID not supported"));
  }

  isSupported() {
    try {
      const result = !!navigator?.bluetooth;
      this._logger.debug(`isSupported: ${result}`);
      return result;
    } catch (error) {
      this._logger.error(`isSupported: error`, { data: { error } });
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
    const [bleGattService] = await bleDevice.gatt.getPrimaryServices();

    if (!bleGattService) {
      return Left(new BleDeviceGattServerError("bluetooth service not found"));
    }
    return Right(bleGattService);
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
    return EitherAsync.liftEither(this.bluetoothApi)
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
          this._logger.error(`promptDeviceAccess: error requesting device`, {
            data: { error },
          });
          throw deviceError;
        }

        this._logger.debug(`promptDeviceAccess: bleDevice found`);
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

    this.startListeningToConnectionEvents();

    this._internalDevicesById.clear();

    return from(this.promptDeviceAccess()).pipe(
      switchMap(async (errorOrBleDevice) =>
        errorOrBleDevice.caseOf({
          Right: async (bleDevice) => {
            // ble connect here as gatt server needs to be opened to fetch gatt service
            if (bleDevice.gatt && !bleDevice.gatt.connected) {
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

    this.stopListeningToConnectionEvents();
  }

  /**
   * Logs `connect` and `disconnect` events for already accessible devices
   */
  private startListeningToConnectionEvents(): void {
    this._logger.debug("startListeningToConnectionEvents");
  }

  private stopListeningToConnectionEvents(): void {
    this._logger.debug("stopListeningToConnectionEvents");
    this._connectionListenersAbortController.abort();
  }

  /**
   * Connect to a BLE device and update the internal state of the associated device
   */
  async connect({
    deviceId,
    onDisconnect,
  }: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, InternalConnectedDevice>> {
    this._logger.debug("connect", { data: { deviceId } });

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
    this._logger.debug("Device connection", { data: { deviceConnection } });
    await deviceConnection.setup();
    this._deviceConnectionById.set(
      internalDevice.bleDevice.id,
      deviceConnection,
    );
    const connectedDevice = new InternalConnectedDevice({
      sendApdu: (apdu) => deviceConnection.sendApdu(apdu),
      deviceModel,
      id: deviceId,
      type: this.connectionType,
      transport: this.identifier,
    });
    this._disconnectionHandlersById.set(internalDevice.bleDevice.id, () => {
      this.disconnect({ connectedDevice }).then(() => onDisconnect(deviceId));
    });
    return Right(connectedDevice);
  }

  /**
   * Disconnect from a BLE device and delete its handlers
   * TODO
   */
  async disconnect(params: {
    connectedDevice: InternalConnectedDevice;
  }): Promise<Either<SdkError, void>> {
    this._logger.debug("disconnect", { data: { connectedDevice: params } });
    const internalDevice = this._internalDevicesById.get(
      params.connectedDevice.id,
    );

    if (!internalDevice) {
      this._logger.error(`Unknown device ${params.connectedDevice.id}`);
      return Left(
        new UnknownDeviceError(`Unknown device ${params.connectedDevice.id}`),
      );
    }
    return Right(void 0);
  }
}
