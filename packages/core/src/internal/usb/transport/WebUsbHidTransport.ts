import { inject, injectable } from "inversify";
import { Either, EitherAsync, Left, Right } from "purify-ts";
import { from, Observable, switchMap } from "rxjs";
import { v4 as uuid } from "uuid";

import type { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { deviceModelDiTypes } from "@internal/device-model/di/deviceModelDiTypes";
import { DeviceId } from "@internal/device-model/model/DeviceModel";
import { ledgerVendorId } from "@internal/usb/data/UsbHidConfig";
import { ConnectedDevice } from "@internal/usb/model/ConnectedDevice";
import { DiscoveredDevice } from "@internal/usb/model/DiscoveredDevice";
import {
  ConnectError,
  DeviceNotRecognizedError,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  type PromptDeviceAccessError,
  UnknownDeviceError,
  UsbHidTransportNotSupportedError,
} from "@internal/usb/model/Errors";

import { UsbHidTransport } from "./UsbHidTransport";

// An attempt to manage the state of several devices with one transport. Not final.
type WebHidInternalDevice = {
  id: DeviceId;
  hidDevice: HIDDevice;
  discoveredDevice: DiscoveredDevice;
  connectedDevice?: ConnectedDevice;
};

@injectable()
export class WebUsbHidTransport implements UsbHidTransport {
  // Maps uncoupled DiscoveredDevice and WebHID's HIDDevice WebHID
  private internalDevicesById: Map<DeviceId, WebHidInternalDevice>;

  private connectionListenersAbortController: AbortController;

  constructor(
    @inject(deviceModelDiTypes.DeviceModelDataSource)
    private deviceModelDataSource: DeviceModelDataSource,
  ) {
    this.internalDevicesById = new Map();
    this.connectionListenersAbortController = new AbortController();
  }

  /**
   * @returns `Either` an error if the WebHID API is not supported, or the WebHID API itself
   */
  private hidApi = (): Either<UsbHidTransportNotSupportedError, HID> => {
    if (this.isSupported()) {
      return Right(navigator.hid);
    }

    return Left(
      new UsbHidTransportNotSupportedError(new Error("WebHID not supported")),
    );
  };

  isSupported(): boolean {
    try {
      const result = !!navigator?.hid;
      console.log(`isSupported: ${result}`);
      return result;
    } catch (error) {
      console.error(`isSupported: error`, error);
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
    return EitherAsync.liftEither(this.hidApi())
      .map(async (hidApi) => {
        // `requestDevice` returns an array. but normally the user can select only one device at a time.
        let hidDevices: HIDDevice[] = [];

        try {
          hidDevices = await hidApi.requestDevice({
            filters: [{ vendorId: ledgerVendorId }],
          });
        } catch (error) {
          console.error(`promptDeviceAccess: error requesting device`, error);
          throw new NoAccessibleDeviceError(error as Error);
        }

        console.log("promptDeviceAccess: hidDevices len", hidDevices.length);

        // Granted access to 0 device (by clicking on cancel for ex) results in an error
        if (hidDevices.length === 0) {
          console.warn("No device was selected");
          throw new NoAccessibleDeviceError(new Error("No selected device"));
        }

        const discoveredHidDevices: HIDDevice[] = [];

        for (const hidDevice of hidDevices) {
          discoveredHidDevices.push(hidDevice);

          console.log(`promptDeviceAccess: selected device`, hidDevice);
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
  startDiscovering(): Observable<DiscoveredDevice> {
    console.log("startDiscovering");

    // Logs the connection and disconnection events
    this.startListeningToConnectionEvents();

    // There is no unique identifier for the device from the USB/HID connection,
    // so the previously known accessible devices list cannot be trusted.
    this.internalDevicesById.clear();

    return from(this.promptDeviceAccess()).pipe(
      switchMap((either) => {
        return either.caseOf({
          Left: (error) => {
            console.error("Error while getting accessible device", error);
            throw error;
          },
          Right: (hidDevices) => {
            console.log(`Got access to ${hidDevices.length} HID devices:`);

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

                console.log(
                  `Discovered device ${id} ${discoveredDevice.deviceModel.productName}`,
                );
                this.internalDevicesById.set(id, internalDevice);

                return discoveredDevice;
              } else {
                // [ASK] Or we just ignore the not recognized device ? And log them
                console.warn(
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
    console.log("stopDiscovering");

    this.stopListeningToConnectionEvents();
  }

  /**
   * Logs `connect` and `disconnect` events for already accessible devices
   */
  private startListeningToConnectionEvents(): void {
    console.log("startListeningToConnectionEvents");

    this.hidApi().map((hidApi) => {
      hidApi.addEventListener(
        "connect",
        (event) => {
          console.log("connection event", event);
        },
        { signal: this.connectionListenersAbortController.signal },
      );

      hidApi.addEventListener(
        "disconnect",
        (event) => {
          console.log("disconnect event", event);
        },
        { signal: this.connectionListenersAbortController.signal },
      );
    });
  }

  private stopListeningToConnectionEvents(): void {
    console.log("stopListeningToConnectionEvents");
    this.connectionListenersAbortController.abort();
  }

  /**
   * Connect to a HID USB device and update the internal state of the associated device
   */
  async connect({
    deviceId,
  }: {
    deviceId: DeviceId;
  }): Promise<Either<ConnectError, ConnectedDevice>> {
    console.log("connect", { deviceId });

    const internalDevice = this.internalDevicesById.get(deviceId);

    if (!internalDevice) {
      console.error(`Unknown device ${deviceId}`);
      return Left(
        new UnknownDeviceError(new Error(`Unknown device ${deviceId}`)),
      );
    }

    try {
      await internalDevice.hidDevice.open();
    } catch (error) {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        console.info(`Device ${deviceId} is already opened`);
      } else {
        console.error(`Error while opening device: ${deviceId}`, error);
        return Left(new OpeningConnectionError(error as Error));
      }
    }

    internalDevice.connectedDevice = {
      id: deviceId,
      deviceModel: internalDevice.discoveredDevice.deviceModel,
    };

    // TODO: return a device session USB
    return Right(internalDevice.connectedDevice);
  }

  /**
   * The USB/HID product id is represented by only the 2nd byte
   */
  private getHidUsbProductId(productId: number): number {
    return productId >> 8;
  }
}