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
  OpeningConnectionError,
  type Transport,
  TransportConnectedDevice,
  type TransportDeviceModel,
  type TransportDiscoveredDevice,
  type TransportIdentifier,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import * as Sentry from "@sentry/minimal";
import { type Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { BehaviorSubject, from, map, type Observable, switchMap } from "rxjs";
import { v4 as uuid } from "uuid";

import { FRAME_SIZE } from "@api/data/WebHidConfig";
import { WebHidTransportNotSupportedError } from "@api/model/Errors";
import { WebHidDeviceConnection } from "@api/transport/WebHidDeviceConnection";

type PromptDeviceAccessError =
  | NoAccessibleDeviceError
  | WebHidTransportNotSupportedError;

type WebWebHidTransportDiscoveredDevice = TransportDiscoveredDevice & {
  hidDevice: HIDDevice;
};

export const webHidIdentifier: TransportIdentifier = "WEB-HID";

export class WebHidTransport implements Transport {
  /** List of HID devices that have been discovered */
  private _transportDiscoveredDevices: BehaviorSubject<
    Array<WebWebHidTransportDiscoveredDevice>
  > = new BehaviorSubject<Array<WebWebHidTransportDiscoveredDevice>>([]);

  /** Map of *connected* HIDDevice to their WebHidDeviceConnection */
  private _deviceConnectionsByHidDevice: Map<
    HIDDevice,
    WebHidDeviceConnection
  > = new Map();

  /**
   * Set of WebHidDeviceConnection for which the HIDDevice has been
   * disconnected, so they are waiting for a reconnection
   */
  private _deviceConnectionsPendingReconnection: Set<WebHidDeviceConnection> =
    new Set();

  /** AbortController to stop listening to HID connection events */
  private _connectionListenersAbortController: AbortController =
    new AbortController();
  private _logger: LoggerPublisherService;
  private readonly connectionType: ConnectionType = "USB";
  private readonly identifier: TransportIdentifier = webHidIdentifier;

  constructor(
    private readonly _deviceModelDataSource: DeviceModelDataSource,
    private readonly _loggerServiceFactory: (
      tag: string,
    ) => LoggerPublisherService,
    private readonly _apduSenderFactory: ApduSenderServiceFactory,
    private readonly _apduReceiverFactory: ApduReceiverServiceFactory,
  ) {
    this._logger = _loggerServiceFactory("WebWebHidTransport");

    this.startListeningToConnectionEvents();
  }

  /**
   * Get the WebHID API if supported or error
   * @returns `Either<WebHidTransportNotSupportedError, HID>`
   */
  private get hidApi(): Either<WebHidTransportNotSupportedError, HID> {
    if (this.isSupported()) {
      return Right(navigator.hid);
    }

    return Left(new WebHidTransportNotSupportedError("WebHID not supported"));
  }

  isSupported() {
    try {
      const result = !!navigator?.hid;
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
  private async getDevices(): Promise<Either<DmkError, HIDDevice[]>> {
    return EitherAsync.liftEither(this.hidApi).map(async (hidApi) => {
      try {
        const allDevices = await hidApi.getDevices();

        return allDevices.filter(
          (hidDevice) => hidDevice.vendorId === LEDGER_VENDOR_ID,
        );
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
    hidDevice: HIDDevice,
  ): WebWebHidTransportDiscoveredDevice {
    const existingDiscoveredDevice = this._transportDiscoveredDevices
      .getValue()
      .find((internalDevice) => internalDevice.hidDevice === hidDevice);

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
  public listenToKnownDevices(): Observable<TransportDiscoveredDevice[]> {
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
    Either<PromptDeviceAccessError, HIDDevice[]>
  > {
    return EitherAsync.liftEither(this.hidApi)
      .map(async (hidApi) => {
        // `requestDevice` returns an array. but normally the user can select only one device at a time.
        let hidDevices: HIDDevice[] = [];

        try {
          hidDevices = await hidApi.requestDevice({
            filters: [{ vendorId: LEDGER_VENDOR_ID }],
          });
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

        const discoveredHidDevices: HIDDevice[] = [];

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

    this.hidApi.map((hidApi) => {
      hidApi.addEventListener(
        "connect",
        (event) => this.handleDeviceConnectionEvent(event),
        { signal: this._connectionListenersAbortController.signal },
      );

      hidApi.addEventListener(
        "disconnect",
        (event) => this.handleDeviceDisconnectionEvent(event),
        { signal: this._connectionListenersAbortController.signal },
      );
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

    try {
      if (
        this._deviceConnectionsByHidDevice.get(matchingInternalDevice.hidDevice)
      ) {
        throw new Error("Device already opened");
      }
      await matchingInternalDevice.hidDevice.open();
    } catch (error) {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        this._logger.debug(`Device ${deviceId} is already opened`);
      } else {
        const connectionError = new OpeningConnectionError(error);
        this._logger.debug(`Error while opening device: ${deviceId}`, {
          data: { error },
        });
        Sentry.captureException(connectionError);
        return Left(connectionError);
      }
    }

    const { deviceModel } = matchingInternalDevice;

    const channel = Maybe.of(
      FramerUtils.numberToByteArray(Math.floor(Math.random() * 0xffff), 2),
    );
    const deviceConnection = new WebHidDeviceConnection(
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
          deviceConnection.device.close();
        },
      },
      this._loggerServiceFactory,
    );

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

  private getDeviceModel(hidDevice: HIDDevice): Maybe<TransportDeviceModel> {
    const { productId } = hidDevice;
    const matchingModel = this._deviceModelDataSource.getAllDeviceModels().find(
      (deviceModel) =>
        // outside of bootloader mode, the value that we need to identify a device model is the first byte of the actual hidDevice.productId
        deviceModel.usbProductId === productId >> 8 ||
        deviceModel.bootloaderUsbProductId === productId,
    );
    return matchingModel ? Maybe.of(matchingModel) : Maybe.zero();
  }

  private getHidUsbProductId(hidDevice: HIDDevice): number {
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
   * Type guard to check if the event is a HID connection event
   * @param event
   * @private
   */
  private isHIDConnectionEvent(event: Event): event is HIDConnectionEvent {
    return (
      "device" in event &&
      typeof event.device === "object" &&
      event.device !== null &&
      "productId" in event.device &&
      typeof event.device.productId === "number"
    );
  }

  /**
   * Handle the disconnection event of a HID device
   * @param event
   */
  private async handleDeviceDisconnectionEvent(event: Event) {
    if (!this.isHIDConnectionEvent(event)) {
      this._logger.error("Invalid event", { data: { event } });
      return;
    }

    this._logger.info("[handleDeviceDisconnectionEvent] Device disconnected", {
      data: { event },
    });

    this.updateTransportDiscoveredDevices();

    try {
      await event.device.close();
    } catch (error) {
      this._logger.error("Error while closing device ", {
        data: { event, error },
      });
    }

    const matchingDeviceConnection = this._deviceConnectionsByHidDevice.get(
      event.device,
    );

    if (matchingDeviceConnection) {
      matchingDeviceConnection.lostConnection();
      this._deviceConnectionsPendingReconnection.add(matchingDeviceConnection);
      this._deviceConnectionsByHidDevice.delete(event.device);
    }
  }

  private handleDeviceReconnection(
    deviceConnection: WebHidDeviceConnection,
    hidDevice: HIDDevice,
  ) {
    this._deviceConnectionsPendingReconnection.delete(deviceConnection);
    this._deviceConnectionsByHidDevice.set(hidDevice, deviceConnection);

    console.log(`🦖 Reconnecting device 🎉`);
    console.log(deviceConnection);

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
   * @param event
   */
  private handleDeviceConnectionEvent(event: Event) {
    if (!this.isHIDConnectionEvent(event)) {
      this._logger.error("Invalid event", { data: { event } });
      return;
    }

    this._logger.info("[handleDeviceConnectionEvent] Device connected", {
      data: { event },
    });

    const matchingDeviceConnection = Array.from(
      this._deviceConnectionsPendingReconnection,
    ).find(
      (deviceConnection) =>
        this.getHidUsbProductId(deviceConnection.device) ===
        this.getHidUsbProductId(event.device),
    );

    if (matchingDeviceConnection) {
      this.handleDeviceReconnection(matchingDeviceConnection, event.device);
    }

    /**
     * Note: we do this after handling the reconnection to allow the newly
     * discovered device to keep the same DeviceId as the previous one in case
     * of a reconnection.
     */
    this.updateTransportDiscoveredDevices();
  }

  public destroy() {
    this.stopListeningToConnectionEvents();
    this._deviceConnectionsByHidDevice.forEach((connection) => {
      connection.disconnect();
    });
    this._deviceConnectionsPendingReconnection.clear();
  }
}
