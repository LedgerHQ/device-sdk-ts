/* eslint @typescript-eslint/consistent-type-imports: off */
import {
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderServiceFactory,
  connectedDeviceStubBuilder,
  DeviceConnectionStateMachine,
  type DeviceConnectionStateMachineParams,
  type DeviceModel,
  DeviceModelId,
  DeviceNotRecognizedError,
  type LoggerPublisherService,
  type LoggerSubscriberService,
  NoAccessibleDeviceError,
  OpeningConnectionError,
  StaticDeviceModelDataSource,
  type TransportDeviceModel,
  type TransportDiscoveredDevice,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import type { Device as NodeHIDDevice } from "node-hid";
import { Left, Right } from "purify-ts";
import { lastValueFrom, toArray } from "rxjs";

import { RECONNECT_DEVICE_TIMEOUT } from "@api/data/NodeHidConfig";
import { nodeHidDeviceStubBuilder } from "@api/model/HIDDevice.stub";

import {
  NodeHidApduSender,
  type NodeHidApduSenderDependencies,
} from "./NodeHidApduSender";
import { NodeHidTransport } from "./NodeHidTransport";

// Mock node-hid module
const mockDevicesAsync = vi.fn();
vi.mock("node-hid", () => ({
  devicesAsync: (...args: unknown[]) => mockDevicesAsync(...args),
  HIDAsync: {
    open: vi.fn(),
  },
}));

// Mock usb module
const mockUsbOn = vi.fn();
const mockUsbAttachCallbacks: ((device: unknown) => void)[] = [];
const mockUsbDetachCallbacks: ((device: unknown) => void)[] = [];

vi.mock("usb", () => ({
  usb: {
    on: (event: string, callback: (device: unknown) => void) => {
      mockUsbOn(event, callback);
      if (event === "attach") {
        mockUsbAttachCallbacks.push(callback);
      } else if (event === "detach") {
        mockUsbDetachCallbacks.push(callback);
      }
    },
    removeAllListeners: vi.fn(),
    unrefHotplugEvents: vi.fn(),
  },
  Device: class {},
}));

class LoggerPublisherServiceStub implements LoggerPublisherService {
  constructor(subscribers: LoggerSubscriberService[], tag: string) {
    this.subscribers = subscribers;
    this.tag = tag;
  }
  subscribers: LoggerSubscriberService[] = [];
  tag: string = "";
  error = vi.fn();
  warn = vi.fn();
  info = vi.fn();
  debug = vi.fn();
}

// Our StaticDeviceModelDataSource can directly be used in our unit tests
const usbDeviceModelDataSource = new StaticDeviceModelDataSource();
const logger = new LoggerPublisherServiceStub([], "node-hid");

const stubDevice: NodeHIDDevice = nodeHidDeviceStubBuilder();

/**
 * Flushes all pending promises
 */
const flushPromises = async () => {
  const timers = await vi.importActual<typeof import("timers")>("timers");
  return new Promise(timers.setImmediate);
};

/**
 * Helper to create a USB device event object matching the usb module's Device type
 */
const createUsbDevice = (vendorId: number, productId: number) => ({
  deviceDescriptor: {
    idVendor: vendorId,
    idProduct: productId,
  },
});

/**
 * Emit a USB attach event
 */
const emitUsbAttachEvent = (vendorId: number, productId: number) => {
  const device = createUsbDevice(vendorId, productId);
  mockUsbAttachCallbacks.forEach((callback) => callback(device));
};

/**
 * Emit a USB detach event
 */
const emitUsbDetachEvent = (vendorId: number, productId: number) => {
  const device = createUsbDevice(vendorId, productId);
  mockUsbDetachCallbacks.forEach((callback) => callback(device));
};

describe("NodeHidTransport", () => {
  let transport: NodeHidTransport;
  let apduReceiverServiceFactoryStub: ApduReceiverServiceFactory;
  let apduSenderServiceFactoryStub: ApduSenderServiceFactory;

  let mockDeviceConnectionStateMachineFactory = vi.fn();
  const mockEventDeviceConnected = vi.fn();
  const mockEventDeviceDisconnected = vi.fn();

  const mockDeviceApduSender = {
    sendApdu: vi.fn().mockResolvedValue(
      Right({
        data: new Uint8Array(),
        statusCode: new Uint8Array([0x90, 0x00]),
      } as ApduResponse),
    ),
    getDependencies: vi.fn().mockReturnValue({ device: stubDevice }),
    setDependencies: vi.fn(),
    closeConnection: vi.fn(),
    setupConnection: vi.fn(),
  };

  const mockDeviceConnectionStateMachine = {
    getDependencies: vi.fn().mockReturnValue({ device: stubDevice }),
    setDependencies: vi.fn(),
    getDeviceId: vi.fn(),
    sendApdu: vi.fn().mockResolvedValue(
      Right({
        data: new Uint8Array(),
        statusCode: new Uint8Array([0x90, 0x00]),
      } as ApduResponse),
    ),
    setupConnection: vi.fn(),
    eventDeviceConnected: mockEventDeviceConnected,
    eventDeviceDisconnected: mockEventDeviceDisconnected,
    closeConnection: vi.fn(),
  };

  function initializeTransport() {
    // Clear callbacks before reinitializing
    mockUsbAttachCallbacks.length = 0;
    mockUsbDetachCallbacks.length = 0;

    apduReceiverServiceFactoryStub = vi.fn();
    apduSenderServiceFactoryStub = vi.fn();
    mockDeviceConnectionStateMachineFactory = vi.fn(
      (
        params: DeviceConnectionStateMachineParams<NodeHidApduSenderDependencies>,
      ) => {
        return {
          ...mockDeviceConnectionStateMachine,
          getDeviceId: vi.fn().mockReturnValue(params.deviceId),
          getDependencies: params.deviceApduSender.getDependencies,
          setDependencies: params.deviceApduSender.setDependencies,
        } as unknown as DeviceConnectionStateMachine<NodeHidApduSenderDependencies>;
      },
    );
    const mockDeviceApduSenderFactory = vi.fn((params) => {
      return {
        ...mockDeviceApduSender,
        getDependencies: () => params.dependencies,
        setDependencies: (dependencies: NodeHidApduSenderDependencies) =>
          (params.dependencies = dependencies),
      } as unknown as NodeHidApduSender;
    });
    transport = new NodeHidTransport(
      usbDeviceModelDataSource,
      () => logger,
      apduSenderServiceFactoryStub,
      apduReceiverServiceFactoryStub,
      mockDeviceConnectionStateMachineFactory,
      mockDeviceApduSenderFactory,
    );
  }

  beforeEach(() => {
    initializeTransport();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const discoverDevice = (
    onSuccess: (discoveredDevice: TransportDiscoveredDevice) => void,
    onError?: (error: unknown) => void,
  ) => {
    transport.startDiscovering().subscribe({
      next: onSuccess,
      error: onError,
    });
  };

  describe("isSupported", () => {
    it("should always support the transport", () => {
      expect(transport.isSupported()).toBe(true);
    });
  });

  describe("getIdentifier", () => {
    it("should return NODE-HID identifier", () => {
      expect(transport.getIdentifier()).toBe("NODE-HID");
    });
  });

  describe("startDiscovering", () => {
    const testCases = usbDeviceModelDataSource
      .getAllDeviceModels()
      .flatMap((deviceModel) => {
        return [
          {
            testTitle: `should emit device when discovered (${deviceModel.productName})`,
            hidDevice: nodeHidDeviceStubBuilder({
              productId: deviceModel.usbProductId << 8,
              product: deviceModel.productName,
            }),
            expectedDeviceModel: deviceModel,
          },
          {
            testTitle: `should emit device when discovered (${deviceModel.productName}, bootloader)`,
            hidDevice: nodeHidDeviceStubBuilder({
              productId: deviceModel.bootloaderUsbProductId,
              product: deviceModel.productName,
            }),
            expectedDeviceModel: deviceModel,
          },
        ];
      });

    testCases.forEach((testCase) => {
      it(
        testCase.testTitle,
        () =>
          new Promise<void>((resolve, reject) => {
            mockDevicesAsync.mockResolvedValueOnce([testCase.hidDevice]);

            discoverDevice(
              (discoveredDevice) => {
                try {
                  expect(discoveredDevice).toEqual(
                    expect.objectContaining({
                      deviceModel: testCase.expectedDeviceModel,
                    }),
                  );

                  resolve();
                } catch (expectError) {
                  reject(expectError as Error);
                }
              },
              (error) => {
                reject(error as Error);
              },
            );
          }),
      );
    });

    it("should emit multiple devices if several are connected", () =>
      new Promise<void>((resolve, reject) => {
        mockDevicesAsync.mockResolvedValueOnce([
          stubDevice,
          nodeHidDeviceStubBuilder({
            productId: 0x5011,
            product: "Ledger Nano S Plus",
            path: "/dev/hidraw1",
          }),
        ]);

        let count = 0;
        discoverDevice(
          (discoveredDevice) => {
            try {
              switch (count) {
                case 0:
                  expect(discoveredDevice).toEqual(
                    expect.objectContaining({
                      deviceModel: expect.objectContaining({
                        id: DeviceModelId.NANO_X,
                        productName: "Ledger Nano X",
                        usbProductId: 0x40,
                      }) as DeviceModel,
                    }),
                  );
                  break;
                case 1:
                  expect(discoveredDevice).toEqual(
                    expect.objectContaining({
                      deviceModel: expect.objectContaining({
                        id: DeviceModelId.NANO_SP,
                        productName: "Ledger Nano S Plus",
                        usbProductId: 0x50,
                      }) as DeviceModel,
                    }),
                  );

                  resolve();
                  break;
              }

              count++;
            } catch (expectError) {
              reject(expectError as Error);
            }
          },
          (error) => {
            reject(error as Error);
          },
        );
      }));

    it("should throw DeviceNotRecognizedError if the device is not recognized", () =>
      new Promise<void>((resolve, reject) => {
        mockDevicesAsync.mockResolvedValueOnce([
          nodeHidDeviceStubBuilder({
            productId: 0x4242,
          }),
        ]);

        discoverDevice(
          () => {
            reject("should not return a device");
          },
          (error) => {
            expect(error).toBeInstanceOf(DeviceNotRecognizedError);
            resolve();
          },
        );
      }));

    it("should emit an error if devicesAsync throws", () =>
      new Promise<void>((resolve, reject) => {
        const message = "devices async error";
        mockDevicesAsync.mockImplementationOnce(() => {
          throw new Error(message);
        });

        discoverDevice(
          () => {
            reject("should not return a device");
          },
          (error) => {
            expect(error).toBeInstanceOf(NoAccessibleDeviceError);
            expect(error).toStrictEqual(
              new NoAccessibleDeviceError(new Error(message)),
            );
            resolve();
          },
        );
      }));

    it("should emit an error if no devices are found", () =>
      new Promise<void>((resolve, reject) => {
        mockDevicesAsync.mockResolvedValueOnce([]);

        discoverDevice(
          (discoveredDevice) => {
            reject(
              `Should not emit any value, but emitted ${JSON.stringify(
                discoveredDevice,
              )}`,
            );
          },
          (error) => {
            try {
              expect(error).toBeInstanceOf(NoAccessibleDeviceError);
              resolve();
            } catch (expectError) {
              reject(expectError as Error);
            }
          },
        );
      }));

    it("should emit the same discoveredDevice object if discovered twice in a row", async () => {
      mockDevicesAsync.mockResolvedValue([stubDevice]);

      const firstDiscoveredDevice = await new Promise<void>(
        (resolve, reject) => {
          discoverDevice(
            () => resolve(),
            (err) => reject(err),
          );
        },
      );
      const secondDiscoveredDevice = await new Promise<void>(
        (resolve, reject) => {
          discoverDevice(
            () => resolve(),
            (err) => reject(err),
          );
        },
      );
      expect(secondDiscoveredDevice).toBe(firstDiscoveredDevice);
    });
  });

  describe("destroy", () => {
    it("should stop monitoring connections when destroyed", () => {
      const abortSpy = vi.spyOn(AbortController.prototype, "abort");

      transport.destroy();

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe("connect", () => {
    it("should throw UnknownDeviceError if no internal device", async () => {
      const connectParams = {
        deviceId: "fake",
        onDisconnect: vi.fn(),
      };

      const connect = await transport.connect(connectParams);

      expect(connect).toStrictEqual(
        Left(new UnknownDeviceError("Unknown device fake")),
      );
    });

    it("should throw OpeningConnectionError if the device cannot be opened", async () => {
      const message = "cannot be opened";
      // Mock the DeviceConnectionStateMachine's setupConnection to reject
      mockDeviceConnectionStateMachine.setupConnection.mockRejectedValueOnce(
        new Error(message),
      );
      mockDevicesAsync.mockResolvedValueOnce([stubDevice]);
      mockDevicesAsync.mockResolvedValue([stubDevice]);

      const discoveredDevice = await lastValueFrom(
        transport.startDiscovering(),
      );
      const connected = await transport.connect({
        deviceId: discoveredDevice.id,
        onDisconnect: vi.fn(),
      });
      expect(connected.isLeft()).toBe(true);
      expect(connected.extract()).toBeInstanceOf(OpeningConnectionError);
    });

    it("should return a device if available", async () => {
      mockDevicesAsync.mockResolvedValueOnce([stubDevice]);
      mockDevicesAsync.mockResolvedValue([stubDevice]);

      const discoveredDevice = await lastValueFrom(
        transport.startDiscovering(),
      );
      const connected = await transport.connect({
        deviceId: discoveredDevice.id,
        onDisconnect: vi.fn(),
      });
      expect(connected.isRight()).toStrictEqual(true);
      expect(connected.extract()).toEqual(
        expect.objectContaining({ id: discoveredDevice.id }),
      );
    });

    it("should return an existing connected device", async () => {
      mockDevicesAsync.mockResolvedValueOnce([stubDevice]);
      mockDevicesAsync.mockResolvedValue([stubDevice]);

      const discoveredDevice = await lastValueFrom(
        transport.startDiscovering(),
      );
      await transport.connect({
        deviceId: discoveredDevice.id,
        onDisconnect: vi.fn(),
      });
      const connected = await transport.connect({
        deviceId: discoveredDevice.id,
        onDisconnect: vi.fn(),
      });
      expect(connected.isRight()).toStrictEqual(true);
      expect(connected.extract()).toEqual(
        expect.objectContaining({ id: discoveredDevice.id }),
      );
    });
  });

  describe("disconnect", () => {
    it("should throw an error if the device is not connected", async () => {
      // given
      const connectedDevice = connectedDeviceStubBuilder();

      // when
      const disconnect = await transport.disconnect({
        connectedDevice,
      });

      expect(disconnect).toStrictEqual(
        Left(new UnknownDeviceError(`Unknown device ${connectedDevice.id}`)),
      );
    });

    it("should disconnect if the device is connected", async () => {
      mockDevicesAsync.mockResolvedValueOnce([stubDevice]);
      mockDevicesAsync.mockResolvedValue([stubDevice]);

      const discoveredDevice = await lastValueFrom(
        transport.startDiscovering(),
      );
      const connected = await transport.connect({
        deviceId: discoveredDevice.id,
        onDisconnect: vi.fn(),
      });
      expect(connected.isRight()).toStrictEqual(true);
      const result = await transport.disconnect({
        connectedDevice: connected.unsafeCoerce(),
      });
      expect(result).toStrictEqual(Right(undefined));
    });

    it("should call disconnect handler if a connected device is unplugged", async () => {
      // Get onTerminated for the first connection only
      let onTerminated1 = vi.fn();
      mockDeviceConnectionStateMachineFactory.mockImplementationOnce(
        (params) => {
          onTerminated1 = params.onTerminated;
          return {
            ...mockDeviceConnectionStateMachine,
            getDeviceId: vi.fn().mockReturnValue(params.deviceId),
          } as unknown as DeviceConnectionStateMachine<NodeHidApduSenderDependencies>;
        },
      );

      // Add 2 discoverable devices
      const hidDevice1 = nodeHidDeviceStubBuilder({ path: "/dev/hidraw0" });
      const hidDevice2 = nodeHidDeviceStubBuilder({
        path: "/dev/hidraw1",
        productId: 0x5011,
      });
      mockDevicesAsync.mockResolvedValueOnce([hidDevice1, hidDevice2]);
      mockDevicesAsync.mockResolvedValue([hidDevice1, hidDevice2]);

      // Connect the 2 devices
      const discoveredDevices = await lastValueFrom(
        transport.startDiscovering().pipe(toArray()),
      );
      expect(discoveredDevices.length).toStrictEqual(2);
      const onDisconnect1 = vi.fn();
      const connected1 = await transport.connect({
        deviceId: discoveredDevices[0]!.id,
        onDisconnect: onDisconnect1,
      });
      const onDisconnect2 = vi.fn();
      const connected2 = await transport.connect({
        deviceId: discoveredDevices[1]!.id,
        onDisconnect: onDisconnect2,
      });
      expect(connected1.isRight()).toStrictEqual(true);
      expect(connected2.isRight()).toStrictEqual(true);

      // unplug the first device
      onTerminated1();
      expect(onDisconnect1).toHaveBeenCalled();
      expect(onDisconnect2).not.toHaveBeenCalled();
    });

    it("should call disconnect handler if a connected device is unplugged while reconnecting", async () => {
      // Get onTerminated for the first connection only
      let onTerminated1 = vi.fn();
      let tryToReconnect1 = vi.fn();
      mockDeviceConnectionStateMachineFactory.mockImplementationOnce(
        (params) => {
          onTerminated1 = params.onTerminated;
          tryToReconnect1 = params.tryToReconnect;
          return {
            ...mockDeviceConnectionStateMachine,
            getDeviceId: vi.fn().mockReturnValue(params.deviceId),
          } as unknown as DeviceConnectionStateMachine<NodeHidApduSenderDependencies>;
        },
      );

      // Add 2 discoverable devices
      const hidDevice1 = nodeHidDeviceStubBuilder({ path: "/dev/hidraw0" });
      const hidDevice2 = nodeHidDeviceStubBuilder({
        path: "/dev/hidraw1",
        productId: 0x5011,
      });
      mockDevicesAsync.mockResolvedValueOnce([hidDevice1, hidDevice2]);
      mockDevicesAsync.mockResolvedValue([hidDevice1, hidDevice2]);

      // Connect the 2 devices
      const discoveredDevices = await lastValueFrom(
        transport.startDiscovering().pipe(toArray()),
      );
      expect(discoveredDevices.length).toStrictEqual(2);
      const onDisconnect1 = vi.fn();
      const connected1 = await transport.connect({
        deviceId: discoveredDevices[0]!.id,
        onDisconnect: onDisconnect1,
      });
      const onDisconnect2 = vi.fn();
      const connected2 = await transport.connect({
        deviceId: discoveredDevices[1]!.id,
        onDisconnect: onDisconnect2,
      });
      expect(connected1.isRight()).toStrictEqual(true);
      expect(connected2.isRight()).toStrictEqual(true);

      // Try to reconnect the first device
      tryToReconnect1();

      // unplug the first device
      onTerminated1();
      expect(onDisconnect1).toHaveBeenCalled();
      expect(onDisconnect2).not.toHaveBeenCalled();
    });
  });

  describe("reconnect", () => {
    it("should stop disconnection if reconnection happens", () =>
      new Promise<void>((resolve, reject) => {
        // given
        const onDisconnect = vi.fn();
        let tryToReconnect = vi.fn();

        const hidDevice1 = nodeHidDeviceStubBuilder({ path: "/dev/hidraw0" });
        const hidDevice2 = nodeHidDeviceStubBuilder({ path: "/dev/hidraw1" });

        mockDevicesAsync.mockResolvedValueOnce([hidDevice1]);
        mockDevicesAsync.mockResolvedValue([hidDevice1, hidDevice2]);
        mockDeviceConnectionStateMachineFactory.mockImplementationOnce(
          (params) => {
            tryToReconnect = params.tryToReconnect;
            return {
              ...mockDeviceConnectionStateMachine,
              getDeviceId: vi.fn().mockReturnValue(params.deviceId),
              getDependencies: params.deviceApduSender.getDependencies,
              setDependencies: params.deviceApduSender.setDependencies,
            } as unknown as DeviceConnectionStateMachine<NodeHidApduSenderDependencies>;
          },
        );

        discoverDevice(async (discoveredDevice) => {
          try {
            await transport.connect({
              deviceId: discoveredDevice.id,
              onDisconnect,
            });

            /* Disconnection */
            emitUsbDetachEvent(0x2c97, 0x40);
            await flushPromises();
            expect(mockEventDeviceDisconnected).toHaveBeenCalled();

            tryToReconnect();
            vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 3);

            /* Reconnection */
            emitUsbAttachEvent(0x2c97, 0x40);

            await flushPromises();
            expect(mockEventDeviceConnected).toHaveBeenCalled();

            vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
            expect(onDisconnect).not.toHaveBeenCalled();
            resolve();
          } catch (error) {
            reject(error as Error);
          }
        });
      }));

    it("should be able to reconnect twice in a row if the device is unplugged and replugged twice", () =>
      new Promise<void>((resolve, reject) => {
        // given
        const onDisconnect = vi.fn();
        let tryToReconnect = vi.fn();

        const hidDevice1 = nodeHidDeviceStubBuilder({ path: "/dev/hidraw0" });
        const hidDevice2 = nodeHidDeviceStubBuilder({ path: "/dev/hidraw1" });
        const hidDevice3 = nodeHidDeviceStubBuilder({ path: "/dev/hidraw2" });

        mockDevicesAsync.mockResolvedValueOnce([hidDevice1]);
        mockDevicesAsync.mockResolvedValue([
          hidDevice1,
          hidDevice2,
          hidDevice3,
        ]);
        mockDeviceConnectionStateMachineFactory.mockImplementationOnce(
          (params) => {
            tryToReconnect = params.tryToReconnect;
            return {
              ...mockDeviceConnectionStateMachine,
              getDeviceId: vi.fn().mockReturnValue(params.deviceId),
              getDependencies: params.deviceApduSender.getDependencies,
              setDependencies: params.deviceApduSender.setDependencies,
            } as unknown as DeviceConnectionStateMachine<NodeHidApduSenderDependencies>;
          },
        );

        // when
        discoverDevice(async (discoveredDevice) => {
          await transport.connect({
            deviceId: discoveredDevice.id,
            onDisconnect,
          });
          try {
            /* First disconnection */
            emitUsbDetachEvent(0x2c97, 0x40);
            await flushPromises();
            expect(mockEventDeviceDisconnected).toHaveBeenCalled();
            tryToReconnect();
            vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 3);

            /* First reconnection */
            emitUsbAttachEvent(0x2c97, 0x40);

            await flushPromises();
            expect(mockEventDeviceConnected).toHaveBeenCalled();
            vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
            expect(onDisconnect).not.toHaveBeenCalled();

            /* Second disconnection */
            emitUsbDetachEvent(0x2c97, 0x40);
            await flushPromises();
            expect(mockEventDeviceDisconnected).toHaveBeenCalled();
            tryToReconnect();
            vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT / 3);

            /* Second reconnection */
            emitUsbAttachEvent(0x2c97, 0x40);

            await flushPromises();
            expect(mockEventDeviceConnected).toHaveBeenCalled();
            vi.advanceTimersByTime(RECONNECT_DEVICE_TIMEOUT);
            expect(onDisconnect).not.toHaveBeenCalled();

            resolve();
          } catch (error) {
            reject(error as Error);
          }
        });
      }));
  });

  describe("listenToAvailableDevices", () => {
    it("should emit the devices already connected before listening", async () => {
      // given
      const hidDevice = nodeHidDeviceStubBuilder();
      mockDevicesAsync.mockResolvedValue([hidDevice]);

      const onComplete = vi.fn();
      const onError = vi.fn();

      let observedDevices: TransportDiscoveredDevice[] = [];
      // when
      transport.listenToAvailableDevices().subscribe({
        next: (knownDevices) => {
          observedDevices = knownDevices;
        },
        complete: onComplete,
        error: onError,
      });

      await flushPromises();

      expect(observedDevices).toEqual([
        expect.objectContaining({
          deviceModel: expect.objectContaining({
            id: DeviceModelId.NANO_X,
          }) as TransportDeviceModel,
        }),
      ]);
      expect(onComplete).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it("should emit the new list of devices after connection and disconnection events", async () => {
      initializeTransport();
      // given
      const hidDevice1 = nodeHidDeviceStubBuilder({
        productId:
          usbDeviceModelDataSource.getDeviceModel({
            id: DeviceModelId.NANO_X,
          }).usbProductId << 8,
        path: "/dev/hidraw0",
      });
      const hidDevice2 = nodeHidDeviceStubBuilder({
        productId:
          usbDeviceModelDataSource.getDeviceModel({ id: DeviceModelId.STAX })
            .usbProductId << 8,
        path: "/dev/hidraw1",
      });
      mockDevicesAsync.mockResolvedValue([hidDevice1]);

      const onComplete = vi.fn();
      const onError = vi.fn();

      let observedDevices: TransportDiscoveredDevice[] = [];
      // when
      transport.listenToAvailableDevices().subscribe({
        next: (knownDevices) => {
          observedDevices = knownDevices;
        },
        complete: onComplete,
        error: onError,
      });

      await flushPromises();

      expect(observedDevices).toEqual([
        expect.objectContaining({
          deviceModel: expect.objectContaining({
            id: DeviceModelId.NANO_X,
          }) as TransportDeviceModel,
        }),
      ]);

      // When a new device is connected
      mockDevicesAsync.mockResolvedValue([hidDevice1, hidDevice2]);
      emitUsbAttachEvent(0x2c97, 0x60);
      await flushPromises();

      expect(observedDevices).toEqual([
        expect.objectContaining({
          deviceModel: expect.objectContaining({
            id: DeviceModelId.NANO_X,
          }) as TransportDeviceModel,
        }),
        expect.objectContaining({
          deviceModel: expect.objectContaining({
            id: DeviceModelId.STAX,
          }) as TransportDeviceModel,
        }),
      ]);

      // When a device is disconnected
      mockDevicesAsync.mockResolvedValue([hidDevice2]);
      emitUsbDetachEvent(0x2c97, 0x40);
      await flushPromises();

      expect(observedDevices).toEqual([
        expect.objectContaining({
          deviceModel: expect.objectContaining({
            id: DeviceModelId.STAX,
          }) as TransportDeviceModel,
        }),
      ]);

      expect(onComplete).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it("should preserve DeviceId in case the device has been disconnected and reconnected before the timeout", async () => {
      // given
      const hidDevice = nodeHidDeviceStubBuilder();

      mockDevicesAsync.mockResolvedValue([hidDevice]);

      const onComplete = vi.fn();
      const onError = vi.fn();
      let observedDevices: TransportDiscoveredDevice[] = [];
      // when
      transport.listenToAvailableDevices().subscribe({
        next: (knownDevices) => {
          observedDevices = knownDevices;
        },
        complete: onComplete,
        error: onError,
      });

      await flushPromises();

      const firstObservedDeviceId = observedDevices[0]?.id;
      expect(firstObservedDeviceId).toBeTruthy();
      expect(observedDevices[0]?.deviceModel?.id).toBe(DeviceModelId.NANO_X);

      // Start a connection with the device
      await transport.connect({
        deviceId: observedDevices[0]!.id,
        onDisconnect: vi.fn(),
      });
      await flushPromises();

      // When the device is disconnected
      mockDevicesAsync.mockResolvedValue([]);
      emitUsbDetachEvent(0x2c97, 0x40);
      await flushPromises();

      expect(observedDevices).toEqual([]);

      // When the device is reconnected
      mockDevicesAsync.mockResolvedValue([hidDevice]);
      emitUsbAttachEvent(0x2c97, 0x40);
      await flushPromises();

      expect(observedDevices).toEqual([
        expect.objectContaining({
          deviceModel: expect.objectContaining({
            id: DeviceModelId.NANO_X,
          }) as TransportDeviceModel,
        }),
      ]);

      expect(observedDevices[0]?.id).toBeTruthy();
      expect(observedDevices[0]?.id).toBe(firstObservedDeviceId);
    });
  });

  describe("USB connection events", () => {
    it("should register usb attach and detach listeners on construction", () => {
      expect(mockUsbOn).toHaveBeenCalledWith("attach", expect.any(Function));
      expect(mockUsbOn).toHaveBeenCalledWith("detach", expect.any(Function));
    });

    it("should ignore non-Ledger USB devices", async () => {
      mockDevicesAsync.mockResolvedValue([stubDevice]);

      let observedDevices: TransportDiscoveredDevice[] = [];
      transport.listenToAvailableDevices().subscribe({
        next: (knownDevices) => {
          observedDevices = knownDevices;
        },
      });

      await flushPromises();
      expect(observedDevices.length).toBe(1);

      // Emit attach event for non-Ledger device
      emitUsbAttachEvent(0x1234, 0x5678);
      await flushPromises();

      // Should still be 1 device
      expect(observedDevices.length).toBe(1);
    });
  });
});
