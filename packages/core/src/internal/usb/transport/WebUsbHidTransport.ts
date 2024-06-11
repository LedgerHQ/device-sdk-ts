import * as Sentry from "@sentry/minimal";
import { inject, injectable } from "inversify";
import { Either, EitherAsync, Left, Maybe, Right } from "purify-ts";
import { from, Observable, switchMap } from "rxjs";
import { v4 as uuid } from "uuid";

import { DeviceId } from "@api/device/DeviceModel";
import { SdkError } from "@api/Error";
import type { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { deviceModelTypes } from "@internal/device-model/di/deviceModelTypes";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { LEDGER_VENDOR_ID } from "@internal/usb/data/UsbHidConfig";
import { usbDiTypes } from "@internal/usb/di/usbDiTypes";
import {
  ConnectError,
  DeviceNotRecognizedError,
  DisconnectError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  type PromptDeviceAccessError,
  UnknownDeviceError,
  UsbHidTransportNotSupportedError,
} from "@internal/usb/model/Errors";
import { InternalConnectedDevice } from "@internal/usb/model/InternalConnectedDevice";
import { InternalDiscoveredDevice } from "@internal/usb/model/InternalDiscoveredDevice";
import { UsbHidDeviceConnectionFactory } from "@internal/usb/service/UsbHidDeviceConnectionFactory";

import { UsbHidTransport } from "./UsbHidTransport";

// An attempt to manage the state of several devices with one transport. Not final.
type WebHidInternalDevice = {
  id: DeviceId;
  hidDevice: HIDDevice;
  discoveredDevice: InternalDiscoveredDevice;
};

export type DisconnectHandler = (deviceId: DeviceId) => void;

@injectable()
export class WebUsbHidTransport implements UsbHidTransport {
  // Maps uncoupled DiscoveredDevice and WebHID's HIDDevice WebHID
  private _internalDevicesById: Map<DeviceId, WebHidInternalDevice>;
  private _internalDisconnectionHandlersByHidId: Map<string, () => void>;
  private _connectionListenersAbortController: AbortController;
  private _logger: LoggerPublisherService;
  private _usbHidDeviceConnectionFactory: UsbHidDeviceConnectionFactory;

  constructor(
    @inject(deviceModelTypes.DeviceModelDataSource)
    private deviceModelDataSource: DeviceModelDataSource,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
    @inject(usbDiTypes.UsbHidDeviceConnectionFactory)
    usbHidDeviceConnectionFactory: UsbHidDeviceConnectionFactory,
  ) {
    this._internalDevicesById = new Map();
    this._internalDisconnectionHandlersByHidId = new Map();
    this._connectionListenersAbortController = new AbortController();
    this._logger = loggerServiceFactory("WebUsbHidTransport");
    this._usbHidDeviceConnectionFactory = usbHidDeviceConnectionFactory;

    this.hidApi.map((hidApi) => {
      hidApi.ondisconnect = this.handleDeviceDisconnectionEvent;
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

    return Left(
      new UsbHidTransportNotSupportedError(new Error("WebHID not supported")),
    );
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
          const deviceError = new NoAccessibleDeviceError(error as Error);
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
          throw new NoAccessibleDeviceError(new Error("No selected device"));
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
                  new Error(
                    `Device not recognized: 0x${usbProductId.toString(16)}`,
                  ),
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
      return Left(
        new UnknownDeviceError(new Error(`Unknown device ${deviceId}`)),
      );
    }

    try {
      await internalDevice.hidDevice.open();
    } catch (error) {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        this._logger.debug(`Device ${deviceId} is already opened`);
      } else {
        const connectionError = new OpeningConnectionError(error as Error);
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
    const connectedDevice = new InternalConnectedDevice({
      sendApdu: deviceConnection.sendApdu,
      deviceModel,
      id: deviceId,
      type: "USB",
    });
    this._internalDisconnectionHandlersByHidId.set(
      internalDevice.hidDevice.productId.toString(),
      () => onDisconnect(deviceId),
    );

    return Right(connectedDevice);
  }

  /**
   * The USB/HID product id is represented by only the 2nd byte
   */
  private getHidUsbProductId(productId: number): number {
    return productId >> 8;
  }

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
        new UnknownDeviceError(
          new Error(`Unknown device ${params.connectedDevice.id}`),
        ),
      );
    }

    try {
      await internalDevice.hidDevice.close();
      this._internalDevicesById.delete(internalDevice.id);
      return Right(void 0);
    } catch (error) {
      return Left(new DisconnectError(error as Error));
    }
  }

  private handleDeviceDisconnectionEvent = (event: Event) => {
    this._logger.info("handleDeviceDisconnectionEvent", { data: { event } });
    const hidDevice = (event as HIDConnectionEvent).device;
    const maybeInternalDevice = Maybe.fromFalsy(
      Array.from(this._internalDevicesById.values()).find(
        (iDevice) => iDevice.hidDevice.productId === hidDevice.productId,
      ),
    );

    maybeInternalDevice.map(async (internalDevice) => {
      try {
        await internalDevice.hidDevice.close();
        this._internalDevicesById.delete(internalDevice.id);
      } catch (error) {
        this._logger.error("Error while closing device from event", {
          data: { error },
        });
      }
    });
    const maybeDisconnectHandler = Maybe.fromNullable(
      this._internalDisconnectionHandlersByHidId.get(
        hidDevice.productId.toString(),
      ),
    );
    maybeDisconnectHandler.map((handler) => {
      handler();
      this._internalDisconnectionHandlersByHidId.delete(
        hidDevice.productId.toString(),
      );
    });
  };
}
