import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type ConnectError,
  type ConnectionType,
  type DeviceId,
  type DeviceModelDataSource,
  DeviceNotRecognizedError,
  type DisconnectHandler,
  type DmkError,
  FramerUtils,
  LEDGER_VENDOR_ID,
  type LoggerPublisherService,
  NoAccessibleDeviceError,
  type Transport,
  TransportConnectedDevice,
  type TransportDeviceModel,
  type TransportDiscoveredDevice,
  type TransportFactory,
  type TransportIdentifier,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import * as Sentry from "@sentry/minimal";
import { type Device as NodeHIDDevice, devicesAsync, HIDAsync } from "node-hid";
import { type Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { BehaviorSubject, from, map, type Observable, switchMap } from "rxjs";
import { v4 as uuid } from "uuid";

import { FRAME_SIZE } from "@api/data/NodeHidConfig";
import { NodeHidTransportNotSupportedError } from "@api/model/Errors";
import { NodeHidDeviceConnection } from "@api/transport/NodeHidDeviceConnection";
import { Device, usb } from "usb";

type NodeHIDAPI = typeof NodeHIDAPI;
const NodeHIDAPI = { devicesAsync, HIDAsync } as const;

type PromptDeviceAccessError =
  | NoAccessibleDeviceError
  | NodeHidTransportNotSupportedError;

type NodeHidTransportDiscoveredDevice = TransportDiscoveredDevice & {
  hidDevice: NodeHIDDevice;
};

export const nodeHidIdentifier: TransportIdentifier = "NODE-HID";

export class NodeHidTransport implements Transport {
  /** List of HID devices that have been discovered */
  private _transportDiscoveredDevices: BehaviorSubject<
    Array<NodeHidTransportDiscoveredDevice>
  > = new BehaviorSubject<Array<NodeHidTransportDiscoveredDevice>>([]);

  /** Map of *connected* HIDDevice to their NodeHidDeviceConnection */
  private _deviceConnectionsByHidDevice: Map<
    NodeHIDDevice,
    NodeHidDeviceConnection
  > = new Map();

  /**
   * Set of NodeHidDeviceConnection for which the HIDDevice has been
   * disconnected, so they are waiting for a reconnection
   */
  private _deviceConnectionsPendingReconnection: Set<NodeHidDeviceConnection> =
    new Set();

  /** AbortController to stop listening to HID connection events */
  private _connectionListenersAbortController: AbortController =
    new AbortController();
  private _logger: LoggerPublisherService;
  private readonly connectionType: ConnectionType = "USB";
  private readonly identifier: TransportIdentifier = nodeHidIdentifier;

  constructor(
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    private readonly _loggerServiceFactory: (
      tag: string,
    ) => LoggerPublisherService,
    private readonly _apduSenderFactory: ApduSenderServiceFactory,
    private readonly _apduReceiverFactory: ApduReceiverServiceFactory,
  ) {
    this._logger = _loggerServiceFactory("NodNodeHidTransport");

    this.startListeningToConnectionEvents();
  }

  /**
   * Get the NodeHID API if supported or error
   * @returns `Either<NodeHidTransportNotSupportedError, HID>`
   */
  private get hidApi(): Either<NodeHidTransportNotSupportedError, NodeHIDAPI> {
    if (this.isSupported()) {
      return Right(NodeHIDAPI);
    }
    
    return Left(new NodeHidTransportNotSupportedError("NodeHID not supported"));
  }

  isSupported() {
    try {
      const result = true; // Node hid should be supported !
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
   * Wrapper around `navigator.hid.getDevices()`.
   * It will return the list of plugged in HID devices to which the user has
   * previously granted access through `navigator.hid.requestDevice()`.
   */
  private async getDevices(): Promise<Either<DmkError, NodeHIDDevice[]>> {
    return EitherAsync.liftEither(this.hidApi).map(async (hidApi) => {
      try {
        const allDevices = await hidApi.devicesAsync();

        const ledgerDevices = allDevices.filter(
          (hidDevice) => hidDevice.vendorId === LEDGER_VENDOR_ID,
        );

        // Remove duplicates from same devicewith different interfaces by keeping only one device per vendorId:productId combination
        const uniqueDevices = Array.from(
          new Map(
            ledgerDevices.map((device) => [
              `${device.vendorId}:${device.productId}`,
              device,
            ]),
          ).values(),
        );

        return uniqueDevices;
      } catch (error) {
        const deviceError = new NoAccessibleDeviceError(error);
        this._logger.error(`getDevices: error getting devices`, {
          data: { error },
        });
        Sentry.captureException(deviceError);
        throw deviceError;
      }
    });
  }

  /**
   * Map a HIDDevice to an TransportDiscoveredDevice, either by creating a new one or returning an existing one
   */
  private mapHIDDeviceToTransportDiscoveredDevice(
    hidDevice: NodeHIDDevice,
  ): NodeHidTransportDiscoveredDevice {
    const existingDiscoveredDevice = this._transportDiscoveredDevices
      .getValue()
      .find((internalDevice) => internalDevice.hidDevice.vendorId === hidDevice.vendorId && internalDevice.hidDevice.productId === hidDevice.productId);

    if (existingDiscoveredDevice) {
      return existingDiscoveredDevice;
    }

    const existingDeviceConnection =
      this._deviceConnectionsByHidDevice.get(hidDevice);

    const maybeDeviceModel = this.getDeviceModel(hidDevice);
    return maybeDeviceModel.caseOf({
      Just: (deviceModel) => {
        const id = existingDeviceConnection?.deviceId ?? uuid();

        const discoveredDevice = {
          id,
          deviceModel,
          hidDevice,
          transport: this.identifier,
        };

        this._logger.debug(
          `Discovered device ${id} ${discoveredDevice.deviceModel.productName}`,
        );

        return discoveredDevice;
      },
      Nothing: () => {
        // [ASK] Or we just ignore the not recognized device ? And log them
        this._logger.warn(
          `Device not recognized: hidDevice.productId: 0x${hidDevice.productId.toString(16)}`,
        );
        throw new DeviceNotRecognizedError(
          `Device not recognized: hidDevice.productId: 0x${hidDevice.productId.toString(16)}`,
        );
      },
    });
  }

  /**
   * Listen to known devices (devices to which the user has granted access)
   */
  public listenToAvailableDevices(): Observable<TransportDiscoveredDevice[]> {
    this.updateTransportDiscoveredDevices();
    return this._transportDiscoveredDevices.pipe(
      map((devices) => devices.map(({ hidDevice, ...device }) => device)),
    );
  }

  private async updateTransportDiscoveredDevices(): Promise<void> {
    const eitherDevices = await this.getDevices();

    eitherDevices.caseOf({
      Left: (error) => {
        this._logger.error("Error while getting accessible device", {
          data: { error },
        });
        Sentry.captureException(error);
      },
      Right: (hidDevices) => {
        this._transportDiscoveredDevices.next(
          hidDevices.map((hidDevice) =>
        this.mapHIDDeviceToTransportDiscoveredDevice(hidDevice),
          ),
      );
      },
    });
  }

  /**
   * Wrapper around navigator.hid.requestDevice()
   * In a browser, it will show a native dialog to select a HID device.
   */
  private async promptDeviceAccess(): Promise<
    Either<PromptDeviceAccessError, NodeHIDDevice[]>
  > {
    return EitherAsync.liftEither(this.hidApi)
      .map(async (hidApi) => {
        // `requestDevice` returns an array. but normally the user can select only one device at a time.
        let hidDevices: NodeHIDDevice[] = [];

        try {
          const allDevices = await hidApi.devicesAsync();

          hidDevices = allDevices.filter(
            (d) => d.vendorId === LEDGER_VENDOR_ID,
          );
          await this.updateTransportDiscoveredDevices();
        } catch (error) {
          const deviceError = new NoAccessibleDeviceError(error);
          this._logger.error(`promptDeviceAccess: error requesting device`, {
            data: { error },
          });
          Sentry.captureException(deviceError);
          throw deviceError;
        }

        this._logger.debug(
          `promptDeviceAccess: hidDevices len ${hidDevices.length}`,
        );

        // Granted access to 0 device (by clicking on cancel for ex) results in an error
        if (hidDevices.length === 0) {
          this._logger.warn("No device was selected");
          throw new NoAccessibleDeviceError("No selected device");
        }

        const discoveredHidDevices: NodeHIDDevice[] = [];

        for (const hidDevice of hidDevices) {
          discoveredHidDevices.push(hidDevice);

          this._logger.debug(`promptDeviceAccess: selected device`, {
            data: { hidDevice },
          });
        }

        return discoveredHidDevices;
      })
      .run();
  }

  startDiscovering(): Observable<TransportDiscoveredDevice> {
    this._logger.debug("startDiscovering");

    return from(this.promptDeviceAccess()).pipe(
      switchMap((either) => {
        return either.caseOf({
          Left: (error) => {
            this._logger.error("Error while getting accessible device", {
              data: { error },
            });
            Sentry.captureException(error);
            throw error;
          },
          Right: (hidDevices) => {
            this._logger.info(`Got access to ${hidDevices.length} HID devices`);

            const discoveredDevices = hidDevices.map((hidDevice) => {
              return this.mapHIDDeviceToTransportDiscoveredDevice(hidDevice);
            });

            return from(discoveredDevices);
          },
        });
      }),
    );
  }

  stopDiscovering(): void {
    /**
     * This does nothing because the startDiscovering method is just a
     * promise wrapped into an observable. So there is no need to stop it.
     */
  }

  private startListeningToConnectionEvents(): void {
    this._logger.debug("startListeningToConnectionEvents");

    usb.on("attach", (device) => {
      this.handleDeviceConnection(device);
    });

    usb.on("detach", (device) => {
      this.handleDeviceDisconnection(device);
    });
  }

  private stopListeningToConnectionEvents(): void {
    this._logger.debug("stopListeningToConnectionEvents");
    this._connectionListenersAbortController.abort();
  }

  /**
   * Connect to a HID USB device and update the internal state of the associated device
   */
  async connect({
    deviceId,
    onDisconnect,
  }: {
    deviceId: DeviceId;
    onDisconnect: DisconnectHandler;
  }): Promise<Either<ConnectError, TransportConnectedDevice>> {
    this._logger.debug("connect", { data: { deviceId } });

    const matchingInternalDevice = this._transportDiscoveredDevices
      .getValue()
      .find((internalDevice) => internalDevice.id === deviceId);

    if (!matchingInternalDevice) {
      this._logger.error(`Unknown device ${deviceId}`);
      return Left(new UnknownDeviceError(`Unknown device ${deviceId}`));
    }

    const existingDeviceConnection = this._deviceConnectionsByHidDevice.get(matchingInternalDevice.hidDevice);
    if (existingDeviceConnection) {
      return Right(
        new TransportConnectedDevice({
          id: deviceId,
          deviceModel: matchingInternalDevice.deviceModel,
          type: this.connectionType,
          sendApdu: (apdu, triggersDisconnection, _abortTimeout) => 
            existingDeviceConnection.sendApdu(apdu, triggersDisconnection),
          transport: this.identifier,
        })
      );
    }

    const { deviceModel } = matchingInternalDevice;

    const channel = Maybe.of(
      FramerUtils.numberToByteArray(Math.floor(Math.random() * 0xffff), 2),
    );
    
    const deviceConnection = new NodeHidDeviceConnection(
      {
        device: matchingInternalDevice.hidDevice,
        deviceId,
        apduSender: this._apduSenderFactory({
          frameSize: FRAME_SIZE,
          channel,
          padding: true,
        }),
        apduReceiver: this._apduReceiverFactory({ channel }),
        onConnectionTerminated: () => {
          onDisconnect(deviceId);
          this._deviceConnectionsPendingReconnection.delete(deviceConnection);
          this._deviceConnectionsByHidDevice.delete(
            matchingInternalDevice.hidDevice,
          );
        },
      },
      this._loggerServiceFactory,
    );

    await deviceConnection.ensureConnectionReady();

    this._deviceConnectionsByHidDevice.set(
      matchingInternalDevice.hidDevice,
      deviceConnection,
    );

    const connectedDevice = new TransportConnectedDevice({
      sendApdu: (apdu, triggersDisconnection) =>
        deviceConnection.sendApdu(apdu, triggersDisconnection),
      deviceModel,
      id: deviceId,
      type: this.connectionType,
      transport: this.identifier,
    });

    return Right(connectedDevice);
  }

  private getDeviceModel(
    hidDevice: NodeHIDDevice,
  ): Maybe<TransportDeviceModel> {
    const { productId } = hidDevice;
    const matchingModel = this._deviceModelDataSource.getAllDeviceModels().find(
      (deviceModel) =>
        // outside of bootloader mode, the value that we need to identify a device model is the first byte of the actual hidDevice.productId
        deviceModel.usbProductId === productId >> 8 ||
        deviceModel.bootloaderUsbProductId === productId,
    );
    return matchingModel ? Maybe.of(matchingModel) : Maybe.zero();
  }

  private getHidUsbProductId(hidDevice: NodeHIDDevice): number {
    return this.getDeviceModel(hidDevice).caseOf({
      Just: (deviceModel) => deviceModel.usbProductId,
      Nothing: () => hidDevice.productId >> 8,
    });
  }

  /**
   * Disconnect from a HID USB device
   */
  async disconnect(params: {
    connectedDevice: TransportConnectedDevice;
  }): Promise<Either<DmkError, void>> {
    this._logger.debug("disconnect", { data: { connectedDevice: params } });

    const matchingDeviceConnection = Array.from(
      this._deviceConnectionsByHidDevice.values(),
    ).find(
      (deviceConnection) =>
        deviceConnection.deviceId === params.connectedDevice.id,
    );

    if (!matchingDeviceConnection) {
      this._logger.error("No matching device connection found", {
        data: { connectedDevice: params },
      });
      return Promise.resolve(
        Left(
          new UnknownDeviceError(`Unknown device ${params.connectedDevice.id}`),
        ),
      );
    }

    matchingDeviceConnection.disconnect();
    return Promise.resolve(Right(undefined));
  }

  /**
   * Handle the disconnection event of a HID device
   * @param device USB device that was detached
   */
  private async handleDeviceDisconnection(
    device: Device,
  ): Promise<void> {

    const { idVendor, idProduct } = device.deviceDescriptor;

    if (idVendor !== LEDGER_VENDOR_ID) {
      return;
    }

    this._logger.info("[handleDeviceDisconnectionEvent] Device disconnected", {
      data: { vendorId: idVendor, productId: idProduct },
    });

    
    let matchingDeviceConnection: NodeHidDeviceConnection | undefined;

    for (const [hidDevice, deviceConnection] of this._deviceConnectionsByHidDevice.entries()) {
      if (
        hidDevice.vendorId === idVendor &&
        ((hidDevice.productId >> 8) === idProduct ||
          hidDevice.productId === idProduct)
      ) {
        matchingDeviceConnection = deviceConnection;
        break;
      }
    }

    try {
      await matchingDeviceConnection?.disconnect();
    } catch (error) {
      this._logger.error("Error while disconnecting device", {
        data: { vendorId: idVendor, productId: idProduct, error },
      });
    }

    this.updateTransportDiscoveredDevices();
    return;
  }

  private handleDeviceReconnection(
    deviceConnection: NodeHidDeviceConnection,
    hidDevice: NodeHIDDevice,
  ) {
    this._deviceConnectionsPendingReconnection.delete(deviceConnection);
    this._deviceConnectionsByHidDevice.set(hidDevice, deviceConnection);

    try {
      deviceConnection.reconnectHidDevice(hidDevice);
    } catch (error) {
      this._logger.error("Error while reconnecting to device", {
        data: { event, error },
      });
      deviceConnection.disconnect();
    }
  }

  /**
   * Handle the connection event of a HID device
   * @param device USB device that was attached
   */
  private async handleDeviceConnection(device: Device): Promise<void> {
    const { idVendor, idProduct } = device.deviceDescriptor;

    if (idVendor !== LEDGER_VENDOR_ID) {
      return;
    }

    this._logger.info("[handleDeviceConnection] New device connected", {
      data: { vendorId: idVendor, productId: idProduct },
    });

    // Find the corresponding HID device by matching vendor and product IDs
    const eitherDevices = await this.getDevices();
    eitherDevices.caseOf({
      Left: (error) => {
        this._logger.error("Error while getting HID devices for reconnection", {
          data: { error },
        });
      },
      Right: async (hidDevices) => {
        const matchingHidDevice = hidDevices.find(
          (hidDevice) =>
            hidDevice.vendorId === idVendor &&
            ((hidDevice.productId >> 8) === idProduct ||
              hidDevice.productId === idProduct),
        );

        if (!matchingHidDevice) {
          this._logger.debug(
            "[handleDeviceConnection] No matching HID device found",
            {
              data: { vendorId: idVendor, productId: idProduct },
            },
          );
          
          return;
        }

        // Check if there's a pending reconnection for a device with matching product ID
        const matchingDeviceConnection = Array.from(
          this._deviceConnectionsPendingReconnection,
        ).find(
          (deviceConnection) =>
            this.getHidUsbProductId(deviceConnection.device) ===
            this.getHidUsbProductId(matchingHidDevice),
        );

        if (matchingDeviceConnection) {
          this.handleDeviceReconnection(
            matchingDeviceConnection,
            matchingHidDevice,
          );
        }

        /**
         * Note: we do this after handling the reconnection to allow the newly
         * discovered device to keep the same DeviceId as the previous one in case
         * of a reconnection.
         */
        await this.updateTransportDiscoveredDevices();
      },
    });
  }

  public destroy() {
    this.stopListeningToConnectionEvents();
    this._deviceConnectionsByHidDevice.forEach((connection) => {
      connection.disconnect();
    });
    this._deviceConnectionsPendingReconnection.clear();
  }
}

export const nodeHidTransportFactory: TransportFactory = ({
  deviceModelDataSource,
  loggerServiceFactory,
  apduSenderServiceFactory,
  apduReceiverServiceFactory,
}) =>
  new NodeHidTransport(
    deviceModelDataSource,
    loggerServiceFactory,
    apduSenderServiceFactory,
    apduReceiverServiceFactory,
  );
