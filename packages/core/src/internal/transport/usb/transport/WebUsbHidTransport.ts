import * as Sentry from "@sentry/minimal";
import { inject, injectable } from "inversify";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { from, Observable, Subscription, switchMap, timer } from "rxjs";
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
import {
  LEDGER_VENDOR_ID,
  RECONNECT_DEVICE_TIMEOUT,
} from "@internal/transport/usb/data/UsbHidConfig";
import { usbDiTypes } from "@internal/transport/usb/di/usbDiTypes";
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
import { UsbHidDeviceConnectionFactory } from "@internal/transport/usb/service/UsbHidDeviceConnectionFactory";
import { UsbHidDeviceConnection } from "@internal/transport/usb/transport/UsbHidDeviceConnection";
import { DisconnectHandler } from "@internal/transport/model/DeviceConnection";

// An attempt to manage the state of several devices with one transport. Not final.
type WebHidInternalDevice = {
  id: DeviceId;
  hidDevice: HIDDevice;
  discoveredDevice: InternalDiscoveredDevice;
};

@injectable()
export class WebUsbHidTransport implements Transport {
  // Maps uncoupled DiscoveredDevice and WebHID's HIDDevice WebHID
  private _internalDevicesById: Map<DeviceId, WebHidInternalDevice>;
  private _disconnectionHandlersByHidId: Map<number, () => void>;
  private _deviceConnectionByHidId: Map<number, UsbHidDeviceConnection>;
  private _connectionListenersAbortController: AbortController;
  private _logger: LoggerPublisherService;
  private _usbHidDeviceConnectionFactory: UsbHidDeviceConnectionFactory;
  private _deviceDisconnectionTimerSubscription: Maybe<Subscription> =
    Maybe.zero();
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
    this._internalDevicesById = new Map();
    this._disconnectionHandlersByHidId = new Map();
    this._deviceConnectionByHidId = new Map();
    this._connectionListenersAbortController = new AbortController();
    this._logger = loggerServiceFactory("WebUsbHidTransport");
    this._usbHidDeviceConnectionFactory = usbHidDeviceConnectionFactory;

    this.hidApi.map((hidApi) => {
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

    // There is no unique identifier for the device from the USB/HID connection,
    // so the previously known accessible devices list cannot be trusted.
    this._internalDevicesById.clear();

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
              const usbProductId = this.getHidUsbProductId(hidDevice.productId);
              const deviceModels =
                this.deviceModelDataSource.filterDeviceModels({ usbProductId });

              if (deviceModels.length === 1 && deviceModels[0]) {
                const id = uuid();

                const discoveredDevice = {
                  id,
                  deviceModel: deviceModels[0],
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
              } else {
                // [ASK] Or we just ignore the not recognized device ? And log them
                this._logger.warn(
                  `Device not recognized: 0x${usbProductId.toString(16)}`,
                );
                throw new DeviceNotRecognizedError(
                  `Device not recognized: 0x${usbProductId.toString(16)}`,
                );
              }
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
    );
    this._deviceConnectionByHidId.set(
      this.getHidUsbProductId(internalDevice.hidDevice.productId),
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
    this._disconnectionHandlersByHidId.set(
      this.getHidUsbProductId(internalDevice.hidDevice.productId),
      () => {
        this.disconnect({ connectedDevice }).then(() => onDisconnect(deviceId));
      },
    );
    return Right(connectedDevice);
  }

  /**
   * The USB/HID product id is represented by only the 2nd byte
   */
  private getHidUsbProductId(productId: number): number {
    return productId >> 8;
  }

  /**
   * Disconnect from a HID USB device and delete its handlers
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

    const deviceConnection = this._deviceConnectionByHidId.get(
      this.getHidUsbProductId(internalDevice.hidDevice.productId),
    );

    deviceConnection?.disconnect();

    try {
      const usbProductId = this.getHidUsbProductId(
        internalDevice.hidDevice.productId,
      );
      this._internalDevicesById.delete(internalDevice.id);
      this._disconnectionHandlersByHidId.delete(usbProductId);
      this._deviceConnectionByHidId.delete(usbProductId);
      await internalDevice.hidDevice.close();
      return Right(void 0);
    } catch (error) {
      return Left(new DisconnectError(error));
    }
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

  private _handleDisconnection(
    device: HIDDevice,
    callback: (handler: () => void) => void,
  ) {
    const usbProductId = this.getHidUsbProductId(device.productId);
    const maybeDisconnectHandler = Maybe.fromNullable(
      this._disconnectionHandlersByHidId.get(usbProductId),
    );

    maybeDisconnectHandler.map(callback);
  }

  /**
   * Handle the disconnection event of a HID device
   * @param event
   */
  private handleDeviceDisconnectionEvent(event: Event) {
    if (!this.isHIDConnectionEvent(event)) {
      this._logger.error("Invalid event", { data: { event } });
      return;
    }

    this._handleDisconnection(event.device, (handler) => {
      // We start a timer to disconnect the device if the device has a disconnect handler (ie is already connected)
      this._logger.debug(`Start delay of ${RECONNECT_DEVICE_TIMEOUT}ms`);
      this._deviceDisconnectionTimerSubscription = Maybe.of(
        timer(RECONNECT_DEVICE_TIMEOUT).subscribe(() => {
          this._logger.debug("Disconnecting device");

          handler();
          this._deviceDisconnectionTimerSubscription = Maybe.zero();
        }),
      );
    });
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

    // If a disconnection blocking timer is running, we stop it and reconnect
    try {
      this._deviceDisconnectionTimerSubscription.map(async (timerSub) => {
        timerSub.unsubscribe();
        const maybeDeviceConnection = Maybe.fromNullable(
          this._deviceConnectionByHidId.get(
            this.getHidUsbProductId(event.device.productId),
          ),
        );
        await event.device.open();
        maybeDeviceConnection.map(
          (dConnection) => (dConnection.device = event.device),
        );
      });
    } catch (error) {
      this._logger.error("Error while reconnecting to device", {
        data: { event, error },
      });
      this._handleDisconnection(event.device, (disconnectHandler) => {
        disconnectHandler();
        this._logger.debug("Disconnecting device", {
          data: { device: event.device },
        });
      });
    }
  }
}
