import * as Sentry from "@sentry/minimal";
import { inject, injectable } from "inversify";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
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
import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { DisconnectHandler } from "@internal/transport/model/DeviceConnection";
import {
  ConnectError,
  DeviceNotRecognizedError,
  DisconnectError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  type PromptDeviceAccessError,
  UnknownDeviceError,
  UsbHidTransportNotSupportedError,
} from "@internal/transport/model/Errors";
import { InternalConnectedDevice } from "@internal/transport/model/InternalConnectedDevice";
import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";
import { LEDGER_VENDOR_ID } from "@internal/transport/usb/data/UsbHidConfig";
import { usbDiTypes } from "@internal/transport/usb/di/usbDiTypes";
import { UsbHidDeviceConnectionFactory } from "@internal/transport/usb/service/UsbHidDeviceConnectionFactory";
import { UsbHidDeviceConnection } from "@internal/transport/usb/transport/UsbHidDeviceConnection";

// An attempt to manage the state of several devices with one transport. Not final.
type WebHidInternalDevice = {
  id: DeviceId;
  hidDevice: HIDDevice;
  discoveredDevice: InternalDiscoveredDevice;
};

@injectable()
export class WebUsbHidTransport implements Transport {
  /** Maps DeviceId to an internal object containing the associated DiscoveredDevice and HIDDevice */
  private _internalDevicesById: Map<DeviceId, WebHidInternalDevice> = new Map();
  /** Maps all *connected* HIDDevice to their UsbHidDeviceConnection */
  private _deviceConnectionsByHidDevice: Map<
    HIDDevice,
    UsbHidDeviceConnection
  > = new Map();
  /** Set of all the UsbHidDeviceConnection for which HIDDevice has been disconnected, so they are waiting for a reconnection */
  private _deviceConnectionsPendingReconnection: Set<UsbHidDeviceConnection> =
    new Set();
  /** AbortController to stop listening to HID connection events */
  private _connectionListenersAbortController: AbortController;
  private _logger: LoggerPublisherService;
  private _usbHidDeviceConnectionFactory: UsbHidDeviceConnectionFactory;
  private readonly connectionType: ConnectionType = "USB";
  private readonly identifier: TransportIdentifier = BuiltinTransports.USB;

  constructor(
    @inject(deviceModelTypes.DeviceModelDataSource)
    private deviceModelDataSource: DeviceModelDataSource,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
    @inject(usbDiTypes.UsbHidDeviceConnectionFactory)
    usbHidDeviceConnectionFactory: UsbHidDeviceConnectionFactory,
  ) {
    this._connectionListenersAbortController = new AbortController();
    this._logger = loggerServiceFactory("WebUsbHidTransport");
    this._usbHidDeviceConnectionFactory = usbHidDeviceConnectionFactory;

    this.hidApi.map((hidApi) => {
      // FIXME: we should not override the global navigator.hid.onconnect and navigator.hid.ondisconnect but instead use addEventListener
      // The thing is if we want to do that we need a destroy() method on the SDK to remove the event listeners
      hidApi.ondisconnect = (event) =>
        this.handleDeviceDisconnectionEvent(event);
      hidApi.onconnect = (event) => this.handleDeviceConnectionEvent(event);
    });
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
   * Currently: as there is no way to uniquely identify a device, we might need to always update the internal mapping
   * of devices when prompting for device access.
   *
   * Also, we cannot trust hidApi.getDevices() as 2 devices of the same models (even on the same USB port) will be recognized
   * as the same devices.
   */
  // private async promptDeviceAccess(): Promise<Either<PromptDeviceAccessError, DiscoveredDeviceDto[]>> {
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

  /**
   * For WebHID, the client can only discover devices for which the user granted access to.
   *
   * The issue is that once a user grant access to a device of a model/productId A, any other model/productId A device will be accessible.
   * Even if plugged on another USB port.
   * So we cannot rely on the `hid.getDevices` to get the list of accessible devices, because it is not possible to differentiate
   * between 2 devices of the same model.
   * Neither on `connect` and `disconnect` events.
   * We can only rely on the `hid.requestDevice` because it is the user who will select the device that we can access.
   *
   * 2 possible implementations:
   * - only `hid.requestDevice` and return the one selected device
   * - `hid.getDevices` first to get the previously accessible devices, then a `hid.requestDevice` to get any new one
   *
   * [ASK] Should we also subscribe to hid events `connect` and `disconnect` ?
   *
   * [ASK] For the 2nd option: the DiscoveredDevice could have a `isSelected` property ?
   * So the consumer can directly select this device.
   */
  startDiscovering(): Observable<InternalDiscoveredDevice> {
    this._logger.debug("startDiscovering");

    // Logs the connection and disconnection events
    this.startListeningToConnectionEvents();

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
              const matchingInternalDevice = Array.from(
                this._internalDevicesById.values(),
              ).find(
                (internalDevice) => internalDevice.hidDevice === hidDevice,
              );

              if (matchingInternalDevice) {
                this._logger.debug(
                  `Device already discovered ${matchingInternalDevice.id}`,
                );
                return matchingInternalDevice.discoveredDevice;
              }
              const maybeDeviceModel = this.getDeviceModel(hidDevice);
              return maybeDeviceModel.caseOf({
                Just: (deviceModel) => {
                  const id = uuid();

                  const discoveredDevice = {
                    id,
                    deviceModel,
                    transport: this.identifier,
                  };

                  const internalDevice: WebHidInternalDevice = {
                    id,
                    hidDevice,
                    discoveredDevice,
                  };

                  this._logger.debug(
                    `Discovered device ${id} ${discoveredDevice.deviceModel.productName}`,
                  );
                  this._internalDevicesById.set(id, internalDevice);

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
            });
            return from(discoveredDevices);
          },
        });
      }),
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

    this.hidApi.map((hidApi) => {
      hidApi.addEventListener(
        "connect",
        (event) => {
          this._logger.debug("connection event", { data: { event } });
        },
        { signal: this._connectionListenersAbortController.signal },
      );

      hidApi.addEventListener(
        "disconnect",
        (event) => {
          this._logger.debug("disconnect event", { data: { event } });
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

    const internalDevice = this._internalDevicesById.get(deviceId);

    if (!internalDevice) {
      this._logger.error(`Unknown device ${deviceId}`);
      return Left(new UnknownDeviceError(`Unknown device ${deviceId}`));
    }

    try {
      await internalDevice.hidDevice.open();
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

    const {
      discoveredDevice: { deviceModel },
    } = internalDevice;

    const deviceConnection = this._usbHidDeviceConnectionFactory.create(
      internalDevice.hidDevice,
      {
        onConnectionTerminated: () => {
          onDisconnect(deviceId);
          this._deviceConnectionsPendingReconnection.delete(deviceConnection);
          this.deleteInternalDevice({ internalDevice });
        },
        deviceId,
      },
    );

    this._deviceConnectionsByHidDevice.set(
      internalDevice.hidDevice,
      deviceConnection,
    );
    const connectedDevice = new InternalConnectedDevice({
      sendApdu: (apdu, triggersDisconnection) =>
        deviceConnection.sendApdu(apdu, triggersDisconnection),
      deviceModel,
      id: deviceId,
      type: this.connectionType,
      transport: this.identifier,
    });
    return Right(connectedDevice);
  }

  private getDeviceModel(hidDevice: HIDDevice): Maybe<InternalDeviceModel> {
    const { productId } = hidDevice;
    const matchingModel = this.deviceModelDataSource.getAllDeviceModels().find(
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

  private async deleteInternalDevice(params: {
    internalDevice: WebHidInternalDevice;
  }): Promise<Either<SdkError, void>> {
    this._logger.debug("_internalDisconnect", {
      data: { connectedDevice: params },
    });
    const { internalDevice } = params;

    try {
      this._internalDevicesById.delete(internalDevice.id);
      this._deviceConnectionsByHidDevice.delete(internalDevice.hidDevice);
      await internalDevice.hidDevice.close();
      return Right(void 0);
    } catch (error) {
      return Left(new DisconnectError(error));
    }
  }

  /**
   * Disconnect from a HID USB device
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

    const deviceConnection = this._deviceConnectionsByHidDevice.get(
      internalDevice.hidDevice,
    );

    deviceConnection?.disconnect();

    return this.deleteInternalDevice({
      internalDevice,
    });
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
    if (!matchingDeviceConnection) return;

    const matchingInternalDevice = this._internalDevicesById.get(
      matchingDeviceConnection.deviceId,
    );

    if (!matchingInternalDevice) {
      this._logger.error("Internal device not found", {
        data: { matchingDeviceConnection },
      });
      return;
    }
    this._deviceConnectionsPendingReconnection.delete(matchingDeviceConnection);
    this._deviceConnectionsByHidDevice.set(
      event.device,
      matchingDeviceConnection,
    );

    this._internalDevicesById.set(matchingDeviceConnection.deviceId, {
      ...matchingInternalDevice,
      hidDevice: event.device,
    });

    try {
      matchingDeviceConnection.reconnectHidDevice(event.device);
    } catch (error) {
      this._logger.error("Error while reconnecting to device", {
        data: { event, error },
      });
      matchingDeviceConnection.disconnect();
    }
  }
}
