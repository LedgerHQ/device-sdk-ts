import * as Sentry from "@sentry/minimal";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { BehaviorSubject, from, map, Observable, switchMap } from "rxjs";
import { v4 as uuid } from "uuid";

import { DeviceId } from "@api/device/DeviceModel";
import { ConnectionType } from "@api/discovery/ConnectionType";
import { SdkError } from "@api/Error";
import { Transport } from "@api/transport/model/Transport";
import { TransportIdentifier } from "@api/transport/model/TransportIdentifier";
import type { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { DisconnectHandler } from "@internal/transport/model/DeviceConnection";
import {
  ConnectError,
  DeviceNotRecognizedError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  type PromptDeviceAccessError,
  UnknownDeviceError,
  UsbHidTransportNotSupportedError,
} from "@internal/transport/model/Errors";
import { InternalConnectedDevice } from "@internal/transport/model/InternalConnectedDevice";
import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";
import { LEDGER_VENDOR_ID } from "@internal/transport/usb/data/UsbHidConfig";
import { UsbHidDeviceConnectionFactory } from "@internal/transport/usb/service/UsbHidDeviceConnectionFactory";
import { UsbHidDeviceConnection } from "@internal/transport/usb/transport/UsbHidDeviceConnection";

type WebUsbHidInternalDiscoveredDevice = InternalDiscoveredDevice & {
  hidDevice: HIDDevice;
};

export class WebUsbHidTransport implements Transport {
  static readonly identifier: TransportIdentifier = "USB";
  /** List of HID devices that have been discovered */
  private _internalDiscoveredDevices: BehaviorSubject<
    Array<WebUsbHidInternalDiscoveredDevice>
  > = new BehaviorSubject<Array<WebUsbHidInternalDiscoveredDevice>>([]);

  /** Map of *connected* HIDDevice to their UsbHidDeviceConnection */
  private _deviceConnectionsByHidDevice: Map<
    HIDDevice,
    UsbHidDeviceConnection
  > = new Map();

  /**
   * Set of UsbHidDeviceConnection for which the HIDDevice has been
   * disconnected, so they are waiting for a reconnection
   */
  private _deviceConnectionsPendingReconnection: Set<UsbHidDeviceConnection> =
    new Set();

  /** AbortController to stop listening to HID connection events */
  private _connectionListenersAbortController: AbortController =
    new AbortController();
  private readonly connectionType: ConnectionType = "USB";

  // @TODO: remove those `!`, temp for POC
  private _logger!: LoggerPublisherService;
  private _deviceModelDataSource!: DeviceModelDataSource;
  private _usbHidDeviceConnectionFactory!: UsbHidDeviceConnectionFactory;

  constructor() {
    this.startListeningToConnectionEvents();
  }

  setLogger(logger: LoggerPublisherService) {
    this._logger = logger;
  }
  setDeviceModelDataSource(deviceModelDataSource: DeviceModelDataSource) {
    this._deviceModelDataSource = deviceModelDataSource;
  }
  setDeviceConnectionFactory(
    deviceConnectionFactory: UsbHidDeviceConnectionFactory,
  ) {
    this._usbHidDeviceConnectionFactory = deviceConnectionFactory;
  }

  /**
   * Get the WebHID API if supported or error
   * @returns `Either<UsbHidTransportNotSupportedError, HID>`
   */
  private get hidApi(): Either<UsbHidTransportNotSupportedError, HID> {
    if (this.isSupported()) {
      return Right(navigator.hid);
    }

    return Left(new UsbHidTransportNotSupportedError("WebHID not supported"));
  }

  isSupported() {
    // NOTE: we can't use this._logger because it's not initialized when the transport is created
    try {
      const result = !!navigator?.hid;
      // this._logger.debug(`isSupported: ${result}`);
      return result;
    } catch (_error) {
      // this._logger.error(`isSupported: error`, { data: { error } });
      return false;
    }
  }

  getIdentifier(): TransportIdentifier {
    return WebUsbHidTransport.identifier;
  }

  /**
   * Wrapper around `navigator.hid.getDevices()`.
   * It will return the list of plugged in HID devices to which the user has
   * previously granted access through `navigator.hid.requestDevice()`.
   */
  private async getDevices(): Promise<Either<SdkError, HIDDevice[]>> {
    return EitherAsync.liftEither(this.hidApi)
      .map(async (hidApi) => {
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
      })
      .run();
  }

  /**
   * Map a HIDDevice to an InternalDiscoveredDevice, either by creating a new one or returning an existing one
   */
  private mapHIDDeviceToInternalDiscoveredDevice(
    hidDevice: HIDDevice,
  ): WebUsbHidInternalDiscoveredDevice {
    const existingDiscoveredDevice = this._internalDiscoveredDevices
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
          transport: WebUsbHidTransport.identifier,
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
  public listenToKnownDevices(): Observable<InternalDiscoveredDevice[]> {
    this.updateInternalDiscoveredDevices();
    return this._internalDiscoveredDevices.pipe(
      map((devices) => devices.map(({ hidDevice, ...device }) => device)),
    );
  }

  private async updateInternalDiscoveredDevices(): Promise<void> {
    const eitherDevices = await this.getDevices();
    eitherDevices.caseOf({
      Left: (error) => {
        this._logger.error("Error while getting accessible device", {
          data: { error },
        });
        Sentry.captureException(error);
      },
      Right: (hidDevices) => {
        this._internalDiscoveredDevices.next(
          hidDevices.map((hidDevice) =>
            this.mapHIDDeviceToInternalDiscoveredDevice(hidDevice),
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
          await this.updateInternalDiscoveredDevices();
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

  startDiscovering(): Observable<InternalDiscoveredDevice> {
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
              return this.mapHIDDeviceToInternalDiscoveredDevice(hidDevice);
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
    // NOTE: we can't use this._logger because it's not initialized when the transport is created
    // this._logger.debug("startListeningToConnectionEvents");

    this.hidApi.map((hidApi) => {
      hidApi.addEventListener(
        "connect",
        (event) => this.handleDeviceConnectionEvent(event),
        { signal: this._connectionListenersAbortController.signal },
      );

      hidApi.addEventListener(
        "disconnect",
        (event) => {
          this.handleDeviceDisconnectionEvent(event);
        },
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
  }): Promise<Either<ConnectError, InternalConnectedDevice>> {
    this._logger.debug("connect", { data: { deviceId } });

    const matchingInternalDevice = this._internalDiscoveredDevices
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

    const deviceConnection = this._usbHidDeviceConnectionFactory.create(
      matchingInternalDevice.hidDevice,
      {
        onConnectionTerminated: () => {
          onDisconnect(deviceId);
          this._deviceConnectionsPendingReconnection.delete(deviceConnection);
          this._deviceConnectionsByHidDevice.delete(
            matchingInternalDevice.hidDevice,
          );
          deviceConnection.device.close();
        },
        deviceId,
      },
    );

    this._deviceConnectionsByHidDevice.set(
      matchingInternalDevice.hidDevice,
      deviceConnection,
    );
    const connectedDevice = new InternalConnectedDevice({
      sendApdu: (apdu, triggersDisconnection) =>
        deviceConnection.sendApdu(apdu, triggersDisconnection),
      deviceModel,
      id: deviceId,
      type: this.connectionType,
      transport: WebUsbHidTransport.identifier,
    });
    return Right(connectedDevice);
  }

  private getDeviceModel(hidDevice: HIDDevice): Maybe<InternalDeviceModel> {
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
    connectedDevice: InternalConnectedDevice;
  }): Promise<Either<SdkError, void>> {
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

    this.updateInternalDiscoveredDevices();

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
    deviceConnection: UsbHidDeviceConnection,
    hidDevice: HIDDevice,
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
    this.updateInternalDiscoveredDevices();
  }

  public destroy() {
    this.stopListeningToConnectionEvents();
    this._deviceConnectionsByHidDevice.forEach((connection) => {
      connection.disconnect();
    });
    this._deviceConnectionsPendingReconnection.clear();
  }
}
