/* eslint @typescript-eslint/consistent-type-imports: off */
import { type Platform } from "react-native";
import { BleManager, type Device, State } from "react-native-ble-plx";
import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  BleDeviceInfos,
  DeviceConnectionStateMachine,
  type DeviceConnectionStateMachineParams,
  type DeviceModelDataSource,
  DeviceModelId,
  type DmkConfig,
  type LoggerPublisherService,
  OpeningConnectionError,
  TransportConnectedDevice,
  TransportDeviceModel,
  type TransportDiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { firstValueFrom, Subject, Subscription } from "rxjs";
import { beforeEach, expect } from "vitest";

import {
  BleNotSupported,
  BlePermissionsNotGranted,
  BlePoweredOff,
} from "@api/model/Errors";
import { DefaultPermissionsService } from "@api/permissions/DefaultPermissionsService";
import { PermissionsService } from "@api/permissions/PermissionsService";

import { type RNBleApduSenderDependencies } from "./RNBleApduSender";
import { RNBleTransport } from "./RNBleTransport";
import { RNBleTransportFactory } from "./RNBleTransportFactory";

// ===== MOCKS =====
const fakeLogger: LoggerPublisherService = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  subscribers: [],
};

const consoleLogger: LoggerPublisherService = {
  error: console.error,
  info: console.info,
  warn: console.warn,
  debug: console.debug,
  subscribers: [],
};

vi.mock("react-native", () => ({
  Platform: {},
  PermissionsAndroid: {},
}));

vi.mock("react-native-ble-plx", () => ({
  Device: vi.fn(),
  State: {
    PoweredOn: "PoweredOn",
    Unknown: "Unknown",
    PoweredOff: "PoweredOff",
    Resetting: "Resetting",
    Unsupported: "Unsupported",
    Unauthorized: "Unauthorized",
  },
  BleError: vi.fn(),
  BleManager: vi.fn().mockReturnValue({
    onStateChange: vi.fn(),
    startDeviceScan: vi.fn(),
    stopDeviceScan: vi.fn(),
    connectToDevice: vi.fn(),
    disconnectFromDevice: vi.fn(),
    cancelDeviceConnection: vi.fn(),
    connectedDevices: vi.fn(),
    monitorCharacteristicForDevice: vi.fn(),
    writeCharacteristicWithoutResponseForDevice: vi.fn(),
    discoverAllServicesAndCharacteristicsForDevice: vi.fn(),
    onDeviceDisconnected: vi.fn(),
    isDeviceConnected: vi.fn(),
  }),
}));

// ===== TEST DATA =====
const FAKE_DEVICE_MODEL = new TransportDeviceModel({
  id: DeviceModelId.FLEX,
  productName: "Ledger Flex",
  usbProductId: 0x70,
  bootloaderUsbProductId: 0x0007,
  usbOnly: false,
  memorySize: 1533 * 1024,
  blockSize: 32,
  masks: [0x33300000],
});

const IOS_PLATFORM = { OS: "ios" as const } as Platform;
const ANDROID_PLATFORM = { OS: "android" as const } as Platform;
const WINDOWS_PLATFORM = { OS: "windows" as const } as Platform;

// ===== TEST HELPERS =====
class TestTransportBuilder {
  private deviceModelDataSource: DeviceModelDataSource = createFakeDataSource();
  private loggerServiceFactory = () =>
    fakeLogger as unknown as LoggerPublisherService;
  private apduSenderServiceFactory =
    (() => {}) as unknown as ApduSenderServiceFactory;
  private apduReceiverServiceFactory =
    (() => {}) as unknown as ApduReceiverServiceFactory;
  private bleManager = new BleManager();
  private platform: Platform = IOS_PLATFORM;
  private permissionsService: PermissionsService =
    new DefaultPermissionsService();
  private deviceConnectionStateMachineFactory?: (
    args: DeviceConnectionStateMachineParams<RNBleApduSenderDependencies>,
  ) => DeviceConnectionStateMachine<RNBleApduSenderDependencies>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deviceApduSenderFactory?: (args: any, loggerFactory: any) => any;
  private scanThrottleDelayMs: number = 1000;

  withDeviceModelDataSource(dataSource: DeviceModelDataSource) {
    this.deviceModelDataSource = dataSource;
    return this;
  }

  withPlatform(platform: Platform) {
    this.platform = platform;
    return this;
  }

  withPermissionsService(permissions: PermissionsService) {
    this.permissionsService = permissions;
    return this;
  }

  withBleManager(bleManager: BleManager) {
    this.bleManager = bleManager;
    return this;
  }

  withDeviceConnectionStateMachineFactory(
    factory: (
      args: DeviceConnectionStateMachineParams<RNBleApduSenderDependencies>,
    ) => DeviceConnectionStateMachine<RNBleApduSenderDependencies>,
  ) {
    this.deviceConnectionStateMachineFactory = factory;
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withDeviceApduSenderFactory(factory: (args: any, loggerFactory: any) => any) {
    this.deviceApduSenderFactory = factory;
    return this;
  }

  withLogger(logger: LoggerPublisherService = consoleLogger) {
    this.loggerServiceFactory = () => logger;
    return this;
  }

  withScanThrottleDelayMs(delayMs: number) {
    this.scanThrottleDelayMs = delayMs;
    return this;
  }

  build(): RNBleTransport {
    return new RNBleTransport(
      this.deviceModelDataSource,
      this.loggerServiceFactory,
      this.apduSenderServiceFactory,
      this.apduReceiverServiceFactory,
      this.bleManager,
      this.platform,
      this.permissionsService,
      this.scanThrottleDelayMs,
      this.deviceConnectionStateMachineFactory,
      this.deviceApduSenderFactory,
    );
  }
}

function createFakeDataSource() {
  const getBluetoothServicesMock = vi.fn(() => ["ledgerId"]);
  const getBluetoothServicesInfosMock = vi.fn(() => ({
    ledgerId: new BleDeviceInfos(
      FAKE_DEVICE_MODEL,
      "serviceUuid",
      "notifyUuid",
      "writeCmdUuid",
      "readCmdUuid",
    ),
  }));

  return {
    getBluetoothServices: getBluetoothServicesMock,
    getBluetoothServicesInfos: getBluetoothServicesInfosMock,
    getAllDeviceModels: vi.fn(),
    getDeviceModel: vi.fn(),
    filterDeviceModels: vi.fn(),
  } as unknown as DeviceModelDataSource;
}

function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "deviceId",
    localName: "deviceName",
    serviceUUIDs: ["ledgerId"],
    services: vi.fn().mockResolvedValue([{ uuid: "ledgerId" }]),
    ...overrides,
  } as unknown as Device;
}

function createMockBleManager(
  overrides: Partial<BleManager> = {},
  initialState: State = State.PoweredOn,
): BleManager {
  const mockBleManager = {
    onStateChange: vi
      .fn()
      .mockImplementation(
        (listener: (state: State) => void, emitInitialState: boolean) => {
          if (emitInitialState) listener(initialState);
          return { remove: vi.fn() };
        },
      ),
    startDeviceScan: vi.fn(),
    stopDeviceScan: vi.fn(),
    connectToDevice: vi.fn(),
    disconnectFromDevice: vi.fn(),
    cancelDeviceConnection: vi.fn(),
    connectedDevices: vi.fn().mockResolvedValue([]),
    monitorCharacteristicForDevice: vi.fn(),
    writeCharacteristicWithoutResponseForDevice: vi.fn(),
    discoverAllServicesAndCharacteristicsForDevice: vi.fn(),
    onDeviceDisconnected: vi.fn(),
    isDeviceConnected: vi.fn(),
    state: vi.fn(),
    ...overrides,
  } as unknown as BleManager;

  return mockBleManager;
}

// ===== TEST SUITES =====
describe("RNBleTransportFactory", () => {
  it("should return a RNBleTransport", () => {
    const fakeArgs = {
      deviceModelDataSource:
        createFakeDataSource() as unknown as DeviceModelDataSource,
      loggerServiceFactory: () =>
        fakeLogger as unknown as LoggerPublisherService,
      apduSenderServiceFactory:
        (() => {}) as unknown as ApduSenderServiceFactory,
      apduReceiverServiceFactory:
        (() => {}) as unknown as ApduReceiverServiceFactory,
      config: {} as DmkConfig,
    };

    const transport = RNBleTransportFactory(fakeArgs);

    expect(transport).toBeInstanceOf(RNBleTransport);
  });
});

describe("RNBleTransport", () => {
  let subscription: Subscription | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    if (subscription) {
      subscription.unsubscribe();
    }
  });

  describe("BLE state monitoring", () => {
    test("the constructor should call BleManager.onStateChange with a parameter requesting the initial state", () => {
      const mockedOnStateChange = vi.fn();

      new TestTransportBuilder()
        .withBleManager(
          createMockBleManager({
            onStateChange: mockedOnStateChange,
          }),
        )
        .build();

      expect(mockedOnStateChange).toHaveBeenCalledWith(
        expect.any(Function),
        true,
      );
    });

    describe("observeBleState", () => {
      it("should emit the initial BLE state", async () => {
        const mockedOnStateChange = vi
          .fn()
          .mockImplementation(
            (listener: (state: State) => void, emitInitialState: boolean) => {
              if (emitInitialState) listener(State.PoweredOn);
              return { remove: vi.fn() };
            },
          );
        const transport = new TestTransportBuilder()
          .withBleManager(
            createMockBleManager({
              onStateChange: mockedOnStateChange,
            }),
          )
          .build();

        const observable = transport.observeBleState();

        const initialState = await firstValueFrom(observable);

        expect(initialState).toBe(State.PoweredOn);
      });

      it("should emit the new BLE state values", async () => {
        const statesSubject = new Subject<State>();

        const transport = new TestTransportBuilder()
          .withBleManager(
            createMockBleManager({
              onStateChange: (listener: (state: State) => void) => {
                listener(State.PoweredOn);
                statesSubject.subscribe((newState) => listener(newState));
                return { remove: vi.fn() };
              },
            }),
          )
          .build();

        const observable = transport.observeBleState();

        // When a new state is emitted
        statesSubject.next(State.PoweredOff);

        // Then observeBleState should emit the new state
        const newState = await firstValueFrom(observable);
        expect(newState).toBe(State.PoweredOff);

        // When a new state is emitted
        statesSubject.next(State.Resetting);

        // Then observeBleState should emit the new state
        const newState2 = await firstValueFrom(observable);
        expect(newState2).toBe(State.Resetting);
      });

      it("should recover from an Unknown state by calling BleManager.state() method and emitting the new state", async () => {
        vi.useFakeTimers();
        const statesSubject = new Subject<State>();

        const mockedStateFunction = vi.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(State.PoweredOn);
            }, 10);
          });
        });

        const transport = new TestTransportBuilder()
          .withBleManager(
            createMockBleManager({
              state: mockedStateFunction,
              onStateChange: (listener: (state: State) => void) => {
                statesSubject.subscribe((newState) => listener(newState));
                return { remove: vi.fn() };
              },
            }),
          )
          .build();

        const observable = transport.observeBleState();
        statesSubject.next(State.PoweredOff);

        expect(mockedStateFunction).not.toHaveBeenCalled();

        // Emit new state Unknown
        statesSubject.next(State.Unknown);

        // The value Unknown should be emitted
        const newState = await firstValueFrom(observable);
        expect(newState).toBe(State.Unknown);

        // BleManager.state() should be called
        expect(mockedStateFunction).toHaveBeenCalled();

        vi.advanceTimersByTime(11);

        await Promise.resolve();

        // And the value returned by BleManager.state() should be emitted
        const newState2 = await firstValueFrom(observable);
        expect(newState2).toBe(State.PoweredOn);
      });
    });
  });

  describe("getIdentifier", () => {
    it("should return rnBleTransportIdentifier", () => {
      const transport = new TestTransportBuilder().build();
      const identifier = transport.getIdentifier();
      expect(identifier).toStrictEqual("RN_BLE");
    });
  });

  describe("isSupported", () => {
    it("should return true if platform is ios", () => {
      const transport = new TestTransportBuilder()
        .withPlatform(IOS_PLATFORM)
        .build();

      const isSupported = transport.isSupported();

      expect(isSupported).toBe(true);
    });

    it("should return true if platform is android", () => {
      const transport = new TestTransportBuilder()
        .withPlatform(ANDROID_PLATFORM as Platform)
        .build();

      const isSupported = transport.isSupported();

      expect(isSupported).toBe(true);
    });

    it("should return false if platform is not android nor ios", () => {
      const transport = new TestTransportBuilder()
        .withPlatform(WINDOWS_PLATFORM)
        .build();

      const isSupported = transport.isSupported();

      expect(isSupported).toBe(false);
    });
  });

  describe("startDiscovering", () => {
    it("should emit an empty array", () =>
      new Promise((done, reject) => {
        const transport = new TestTransportBuilder()
          .withPlatform(IOS_PLATFORM)
          .withDeviceModelDataSource(
            createFakeDataSource() as unknown as DeviceModelDataSource,
          )
          .build();

        const observable = transport.startDiscovering();

        subscription = observable.subscribe({
          next: (discoveredDevice) => {
            try {
              expect(discoveredDevice).toStrictEqual([]);
            } catch (e) {
              reject(e);
            }
          },
          error: (e) => {
            reject(e);
            throw e;
          },
          complete: () => {
            done(undefined);
          },
        });
      }));
  });

  describe("stopDiscovering", () => {
    it("should call ble manager stop scan on stop discovering", () => {
      const stopDeviceScan = vi.fn();
      const bleManager = createMockBleManager({
        stopDeviceScan,
        connectedDevices: vi.fn().mockResolvedValueOnce([]),
      });

      const transport = new TestTransportBuilder()
        .withBleManager(bleManager)
        .withPlatform(IOS_PLATFORM)
        .withDeviceModelDataSource(
          createFakeDataSource() as unknown as DeviceModelDataSource,
        )
        .build();

      transport.stopDiscovering();

      expect(stopDeviceScan).toHaveBeenCalled();
    });
  });

  describe("listenToAvailableDevices", () => {
    it("should emit an error if platform is not android nor ios", async () => {
      const transport = new TestTransportBuilder()
        .withBleManager(createMockBleManager())
        .withPlatform(WINDOWS_PLATFORM)
        .build();

      return new Promise((done, reject) => {
        transport.listenToAvailableDevices().subscribe({
          error: (e) => {
            try {
              expect(e).toBeInstanceOf(BleNotSupported);
            } catch (innerError) {
              reject(innerError);
            }
            done(undefined);
          },
          complete: () => {
            reject(new Error("Should not complete"));
          },
        });
      });
    });

    it("should emit an error if BLE state is PoweredOff", async () => {
      const transport = new TestTransportBuilder()
        .withBleManager(createMockBleManager({}, State.PoweredOff))
        .build();

      const observable = transport.listenToAvailableDevices();

      let caughtError: unknown;
      await firstValueFrom(observable).catch((e) => {
        caughtError = e;
      });

      expect(caughtError).toBeInstanceOf(BlePoweredOff);
    });

    describe("permissions check", () => {
      const checkPermissions = vi.fn();
      const requestPermissions = vi.fn();

      const mockedPermissionsService = {
        checkRequiredPermissions: checkPermissions,
        requestRequiredPermissions: requestPermissions,
      };

      const startDeviceScan = vi.fn().mockImplementation(async () => {});
      const bleManager = createMockBleManager({
        startDeviceScan: startDeviceScan,
        stopDeviceScan: vi.fn(),
        connectedDevices: vi.fn().mockResolvedValue([]),
        onDeviceDisconnected: vi.fn(),
        isDeviceConnected: vi.fn(),
        onStateChange: (listener: (state: State) => void) => {
          listener(State.PoweredOn);
          return { remove: vi.fn() };
        },
      });

      it("should call checkPermissions", async () => {
        const transport = new TestTransportBuilder()
          .withBleManager(bleManager)
          .withPlatform(IOS_PLATFORM)
          .withPermissionsService(mockedPermissionsService)
          .build();

        const observable = transport.listenToAvailableDevices();

        await firstValueFrom(observable).catch((e) => {
          expect(e).toBeInstanceOf(BlePermissionsNotGranted);
        });

        expect(checkPermissions).toHaveBeenCalled();
      });

      it("should call BleManager.startDeviceScan if checkPermissions resolves to true", async () => {
        checkPermissions.mockResolvedValue(true);

        const transport = new TestTransportBuilder()
          .withBleManager(bleManager)
          .withPlatform(IOS_PLATFORM)
          .withPermissionsService(mockedPermissionsService)
          .build();

        const observable = transport.listenToAvailableDevices();

        await firstValueFrom(observable).catch((e) => {
          expect(e).toBeInstanceOf(BlePermissionsNotGranted);
        });

        expect(startDeviceScan).toHaveBeenCalled();
      });

      it("should call requestPermissions if checkPermissions resolves to false", async () => {
        checkPermissions.mockResolvedValue(false);

        const transport = new TestTransportBuilder()
          .withBleManager(bleManager)
          .withPlatform(IOS_PLATFORM)
          .withPermissionsService(mockedPermissionsService)
          .build();

        const observable = transport.listenToAvailableDevices();

        await firstValueFrom(observable).catch(() => {});

        expect(requestPermissions).toHaveBeenCalled();
      });

      it("should call BleManager.startDeviceScan if requestPermissions resolves to true", async () => {
        checkPermissions.mockResolvedValue(false);
        requestPermissions.mockResolvedValue(true);

        const transport = new TestTransportBuilder()
          .withBleManager(bleManager)
          .withPlatform(IOS_PLATFORM)
          .withPermissionsService(mockedPermissionsService)
          .build();

        const observable = transport.listenToAvailableDevices();
        await firstValueFrom(transport.observeBleState());
        await firstValueFrom(observable);

        expect(startDeviceScan).toHaveBeenCalled();
      });

      it("should emit an error if checkPermissions and requestPermissions resolve to false", async () => {
        checkPermissions.mockResolvedValue(false);
        requestPermissions.mockResolvedValue(false);

        const transport = new TestTransportBuilder()
          .withBleManager(bleManager)
          .withPlatform(IOS_PLATFORM)
          .withPermissionsService(mockedPermissionsService)
          .build();

        const observable = transport.listenToAvailableDevices();

        return new Promise((done, reject) => {
          observable.subscribe({
            error: (e) => {
              try {
                expect(e).toBeInstanceOf(BlePermissionsNotGranted);
              } catch (innerError) {
                reject(innerError);
              }
              done(undefined);
            },
            complete: () => {
              reject(new Error("Should not complete"));
            },
          });
        });
      });
    });

    it("should return already connected devices and scanned devices", () =>
      new Promise((done, reject) => {
        let scanInterval: NodeJS.Timeout | null = null;

        const connectedDevice = createMockDevice({
          id: "aConnectedDeviceId",
          localName: "aConnectedDeviceName",
        });

        const startScan = vi
          .fn()
          .mockImplementation(async (_uuids, _options, listener) => {
            scanInterval = setInterval(() => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              listener(null, {
                id: "aScannedDeviceId",
                localName: "aScannedDeviceName",
                serviceUUIDs: ["ledgerId"],
                rssi: 1,
              });
            }, 10);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            listener(null, {
              id: "aNonLedgerScannedDeviceId",
              localName: "aNonLedgerScannedDeviceName",
              serviceUUIDs: ["notLedgerId"],
              rssi: 2,
            });
          });

        const stopScan = vi.fn().mockImplementation(() => {
          if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
          }
        });

        const bleManager = createMockBleManager({
          connectedDevices: vi.fn().mockResolvedValue([connectedDevice]),
          startDeviceScan: startScan,
          stopDeviceScan: stopScan,
          onDeviceDisconnected: vi.fn(),
          isDeviceConnected: vi.fn(),
          onStateChange: (listener: (state: State) => void) => {
            listener(State.PoweredOn);
            return { remove: vi.fn() };
          },
        });

        const transport = new TestTransportBuilder()
          .withBleManager(bleManager)
          .withPlatform(IOS_PLATFORM)
          .withDeviceModelDataSource(
            createFakeDataSource() as unknown as DeviceModelDataSource,
          )
          .withScanThrottleDelayMs(1) // Use very fast throttle for tests
          .build();

        const availableDevicesEvents: TransportDiscoveredDevice[][] = [];

        subscription = transport.listenToAvailableDevices().subscribe({
          next: (devices) => {
            availableDevicesEvents.push(devices);
            if (availableDevicesEvents.length === 2) {
              try {
                expect(availableDevicesEvents).toEqual([
                  [
                    {
                      id: "aConnectedDeviceId",
                      name: "aConnectedDeviceName",
                      deviceModel: FAKE_DEVICE_MODEL,
                      transport: "RN_BLE",
                      rssi: undefined,
                    },
                  ],
                  [
                    {
                      id: "aConnectedDeviceId",
                      name: "aConnectedDeviceName",
                      deviceModel: FAKE_DEVICE_MODEL,
                      transport: "RN_BLE",
                      rssi: undefined,
                    },
                    {
                      id: "aScannedDeviceId",
                      name: "aScannedDeviceName",
                      deviceModel: FAKE_DEVICE_MODEL,
                      transport: "RN_BLE",
                      rssi: 1,
                    },
                  ],
                ]);
                done(undefined);
              } catch (e) {
                reject(e);
              }
            }
          },
        });
      }));

    it("should propagate the error if startDeviceScan throws an error", () => {
      const scanError = new Error("startDeviceScan error");
      const startScan = vi.fn().mockRejectedValueOnce(scanError);

      const transport = new TestTransportBuilder()
        .withBleManager(createMockBleManager({ startDeviceScan: startScan }))
        .build();

      const observable = transport.listenToAvailableDevices();

      return new Promise((done, reject) => {
        observable.subscribe({
          error: (observedError) => {
            try {
              expect(observedError).toBe(scanError);
              done(undefined);
            } catch (expectError) {
              reject(expectError);
            }
          },
          complete: () => reject(new Error("Should not complete")),
        });
      });
    });

    it("should propagate the error if startDeviceScan emits an error", () => {
      const scanError = new Error("startDeviceScan error");
      const startScan = vi
        .fn()
        .mockImplementation(
          async (
            _uuids,
            _options,
            listener: (error: Error | null, device: Device) => void,
          ) => {
            listener(scanError, {} as Device);
          },
        );

      const transport = new TestTransportBuilder()
        .withBleManager(createMockBleManager({ startDeviceScan: startScan }))
        .build();

      const observable = transport.listenToAvailableDevices();

      return new Promise((done, reject) => {
        observable.subscribe({
          error: (observedError) => {
            try {
              expect(observedError).toBe(scanError);
              done(undefined);
            } catch (expectError) {
              reject(expectError);
            }
            done(undefined);
          },
          complete: () => reject(new Error("Should not complete")),
        });
      });
    });

    it("should propagate an error if startDeviceScan emits a null device", () => {
      const startScan = vi
        .fn()
        .mockImplementation(
          async (
            _uuids,
            _options,
            listener: (error: Error | null, device: Device | null) => void,
          ) => {
            listener(null, null);
          },
        );

      const transport = new TestTransportBuilder()
        .withBleManager(createMockBleManager({ startDeviceScan: startScan }))
        .build();

      const observable = transport.listenToAvailableDevices();

      return new Promise((done, reject) => {
        observable.subscribe({
          error: (observedError) => {
            try {
              expect(observedError).toEqual(
                new Error("Null device in startDeviceScan callback"),
              );
              done(undefined);
            } catch (expectError) {
              reject(expectError);
            }
          },
        });
      });
    });

    it("should recover from a scanning error, allowing next calls of listenToAvailableDevices to succeed and emit the devices", async () => {
      vi.useFakeTimers();
      const scanError = new Error("A Scan Error");
      const startScan = vi.fn().mockRejectedValueOnce(scanError);

      const transport = new TestTransportBuilder()
        .withBleManager(createMockBleManager({ startDeviceScan: startScan }))
        .build();

      const observable1 = transport.listenToAvailableDevices();

      let caughtError: unknown;
      await firstValueFrom(observable1).catch((e) => {
        caughtError = e;
      });

      expect(caughtError).toBe(scanError);

      startScan.mockImplementation(async (_uuids, _options, listener) => {
        listener(null, {
          id: "aScannedDeviceId",
          localName: "aScannedDeviceName",
          serviceUUIDs: ["ledgerId"],
          rssi: 1,
        });
      });

      const observable2 = transport.listenToAvailableDevices();

      vi.advanceTimersByTime(2000);

      const devices = await firstValueFrom(observable2).catch(() => {
        throw new Error(
          "Caught error in second observable, this should not happen if listenToAvailableDevices recovers from the scanning error",
        );
      });

      expect(devices).toEqual([
        {
          id: "aScannedDeviceId",
          name: "aScannedDeviceName",
          deviceModel: FAKE_DEVICE_MODEL,
          transport: "RN_BLE",
          rssi: 1,
        },
      ]);
    });
  });

  describe("connect", () => {
    it("should throw an error if device id is unknown", async () => {
      const bleManager = createMockBleManager({
        connectedDevices: vi.fn().mockResolvedValue([]),
        discoverAllServicesAndCharacteristicsForDevice: vi
          .fn()
          .mockRejectedValueOnce(
            new Error("discoverAllServicesAndCharacteristicsForDevice error"),
          ),
      });

      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: vi.fn().mockResolvedValue(undefined),
      });

      const transport = new TestTransportBuilder()
        .withBleManager(bleManager)
        .withPlatform(IOS_PLATFORM)
        .withDeviceModelDataSource(
          createFakeDataSource() as unknown as DeviceModelDataSource,
        )
        .withDeviceApduSenderFactory(deviceApduSenderFactory)
        .build();

      const result = await transport.connect({
        // @ts-expect-error test case
        deviceId: null,
        onDisconnect: vi.fn(),
      });

      expect(result).toEqual(
        Left(
          new OpeningConnectionError(
            `discoverAllServicesAndCharacteristicsForDevice error`,
          ),
        ),
      );
    });

    it("should connect to a discovered device with correct MTU and discover services and setup apdu sender", async () => {
      const mockDevice = createMockDevice({
        id: "deviceId",
        localName: "name",
      });

      const startScan = vi
        .fn()
        .mockImplementation(async (_uuids, _options, listener) => {
          // Immediately emit a device to ensure we have results
          listener(null, {
            id: "deviceId",
            localName: "name",
            serviceUUIDs: ["ledgerId"],
            rssi: 42,
          });
        });

      const stopScan = vi.fn();

      const bleManager = createMockBleManager({
        connectedDevices: vi.fn().mockResolvedValue([]),
        startDeviceScan: startScan,
        stopDeviceScan: stopScan,
        connectToDevice: vi.fn().mockResolvedValueOnce(mockDevice),
        discoverAllServicesAndCharacteristicsForDevice: vi
          .fn()
          .mockResolvedValueOnce(mockDevice),
        monitorCharacteristicForDevice: vi.fn(),
        writeCharacteristicWithoutResponseForDevice: vi.fn(),
        onDeviceDisconnected: vi.fn(),
        isDeviceConnected: vi.fn(),
        onStateChange: (listener: (state: State) => void) => {
          listener(State.PoweredOn);
          return { remove: vi.fn() };
        },
      });

      const fakeSetupConnection = vi.fn().mockResolvedValue(undefined);
      const deviceConnectionStateMachineFactory = vi.fn().mockReturnValue({
        sendApdu: vi.fn(),
      });
      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: fakeSetupConnection,
      });

      const transport = new TestTransportBuilder()
        .withBleManager(bleManager)
        .withPlatform(IOS_PLATFORM)
        .withDeviceModelDataSource(
          createFakeDataSource() as unknown as DeviceModelDataSource,
        )
        .withDeviceConnectionStateMachineFactory(
          deviceConnectionStateMachineFactory,
        )
        .withDeviceApduSenderFactory(deviceApduSenderFactory)
        .withScanThrottleDelayMs(1) // Use very fast throttle for tests
        .build();

      // Start listening to devices
      const observable = transport.listenToAvailableDevices();

      const devices = await firstValueFrom(observable);
      const [device] = devices;

      const result = await transport.connect({
        deviceId: device!.id,
        onDisconnect: vi.fn(),
      });

      expect(result.isRight()).toBe(true);
      expect(bleManager.connectToDevice).toHaveBeenCalledWith("deviceId", {
        requestMTU: 156,
      });
      expect(
        bleManager.discoverAllServicesAndCharacteristicsForDevice,
      ).toHaveBeenCalledWith("deviceId");
      expect(fakeSetupConnection).toHaveBeenCalled();
    });

    it("should return a connected device which calls state machine sendApdu", async () => {
      vi.useFakeTimers();

      const mockDevice = createMockDevice({
        id: "deviceId",
        localName: "name",
      });

      const startScan = vi
        .fn()
        .mockImplementation(async (_uuids, _options, listener) => {
          // Immediately emit a device to ensure we have results
          listener(null, {
            id: "deviceId",
            localName: "name",
            serviceUUIDs: ["ledgerId"],
            rssi: 42,
          });
        });

      const stopScan = vi.fn();

      const bleManager = createMockBleManager({
        connectedDevices: vi.fn().mockResolvedValue([]),
        startDeviceScan: startScan,
        stopDeviceScan: stopScan,
        connectToDevice: vi.fn().mockResolvedValueOnce(mockDevice),
        discoverAllServicesAndCharacteristicsForDevice: vi
          .fn()
          .mockResolvedValueOnce(mockDevice),
        monitorCharacteristicForDevice: vi.fn(),
        writeCharacteristicWithoutResponseForDevice: vi.fn(),
        onDeviceDisconnected: vi.fn(),
        isDeviceConnected: vi.fn(),
        onStateChange: (listener: (state: State) => void) => {
          listener(State.PoweredOn);
          return { remove: vi.fn() };
        },
      });

      const fakeSendApdu = vi.fn();
      const deviceConnectionStateMachineFactory = vi.fn().mockReturnValue({
        sendApdu: fakeSendApdu,
      });
      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: vi.fn().mockResolvedValue(undefined),
      });

      const transport = new TestTransportBuilder()
        .withBleManager(bleManager)
        .withPlatform(IOS_PLATFORM)
        .withDeviceModelDataSource(
          createFakeDataSource() as unknown as DeviceModelDataSource,
        )
        .withDeviceConnectionStateMachineFactory(
          deviceConnectionStateMachineFactory,
        )
        .withDeviceApduSenderFactory(deviceApduSenderFactory)
        .build();

      // Start listening to devices
      const observable = transport.listenToAvailableDevices();

      // Advance timers to trigger the throttleTime and allow scan results to be emitted
      vi.advanceTimersByTime(2000);

      const devices = await firstValueFrom(observable);
      const [device] = devices;

      const result = await transport.connect({
        deviceId: device!.id,
        onDisconnect: vi.fn(),
      });

      const connectedDevice = result.extract() as TransportConnectedDevice;
      connectedDevice.sendApdu(Uint8Array.from([0x43, 0x32]));

      expect(result).toEqual(
        Right(
          new TransportConnectedDevice({
            id: "deviceId",
            deviceModel: FAKE_DEVICE_MODEL,
            type: "BLE",
            transport: "RN_BLE",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            sendApdu: expect.any(Function),
            name: "name",
          }),
        ),
      );
      expect(fakeSendApdu).toHaveBeenCalledWith(Uint8Array.from([0x43, 0x32]));
    });
  });

  describe("disconnect", () => {
    it("should disconnect gracefully", async () => {
      vi.useFakeTimers();

      const mockDevice = createMockDevice({
        id: "deviceId",
        localName: "name",
      });

      const startScan = vi
        .fn()
        .mockImplementation(async (_uuids, _options, listener) => {
          listener(null, {
            id: "deviceId",
            localName: "name",
            serviceUUIDs: ["ledgerId"],
            rssi: 42,
          });
        });

      const stopScan = vi.fn();

      const onDeviceDisconnected = vi.fn().mockImplementation(() => {
        return { remove: vi.fn() };
      });

      const fakeCloseConnection = vi.fn();

      const bleManager = createMockBleManager({
        connectedDevices: vi.fn().mockResolvedValue([]),
        startDeviceScan: startScan,
        stopDeviceScan: stopScan,
        connectToDevice: vi.fn().mockResolvedValueOnce(mockDevice),
        discoverAllServicesAndCharacteristicsForDevice: vi
          .fn()
          .mockResolvedValueOnce(mockDevice),
        monitorCharacteristicForDevice: vi.fn(),
        writeCharacteristicWithoutResponseForDevice: vi.fn(),
        onStateChange: (listener: (state: State) => void) => {
          listener(State.PoweredOn);
          return { remove: vi.fn() };
        },
        onDeviceDisconnected,
        isDeviceConnected: vi.fn(),
      });

      const deviceConnectionStateMachineFactory = (
        _args: DeviceConnectionStateMachineParams<RNBleApduSenderDependencies>,
      ) => {
        return new DeviceConnectionStateMachine({
          deviceId: "deviceId",
          deviceApduSender: _args.deviceApduSender,
          timeoutDuration: 1000,
          onTerminated: _args.onTerminated,
          tryToReconnect: _args.tryToReconnect,
        });
      };

      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: vi.fn().mockResolvedValue(undefined),
        closeConnection: fakeCloseConnection,
      });

      const transport = new TestTransportBuilder()
        .withBleManager(bleManager)
        .withPlatform(IOS_PLATFORM)
        .withDeviceModelDataSource(
          createFakeDataSource() as unknown as DeviceModelDataSource,
        )
        .withDeviceConnectionStateMachineFactory(
          deviceConnectionStateMachineFactory,
        )
        .withDeviceApduSenderFactory(deviceApduSenderFactory)
        .build();

      const fakeOnDisconnect = vi.fn();

      // Start listening to devices
      const observable = transport.listenToAvailableDevices();

      // Advance timers to trigger the throttleTime and allow scan results to be emitted
      vi.advanceTimersByTime(2000);

      const devices = await firstValueFrom(observable);
      const [device] = devices;

      const result = await transport.connect({
        deviceId: device!.id,
        onDisconnect: fakeOnDisconnect,
      });

      const res = await transport.disconnect({
        connectedDevice: result.extract() as TransportConnectedDevice,
      });

      expect(res).toEqual(Right(undefined));
      expect(fakeOnDisconnect).toHaveBeenCalled();
      expect(fakeCloseConnection).toHaveBeenCalled();
    });

    it("should handle error while disconnecting", async () => {
      vi.useFakeTimers();

      const mockDevice = createMockDevice({
        id: "deviceId",
        localName: "name",
      });

      const startScan = vi
        .fn()
        .mockImplementation(async (_uuids, _options, listener) => {
          listener(null, {
            id: "deviceId",
            localName: "name",
            serviceUUIDs: ["ledgerId"],
            rssi: 42,
          });
        });

      const stopScan = vi.fn();

      const onDeviceDisconnected = vi.fn().mockImplementation(() => {
        return { remove: vi.fn() };
      });

      const fakeCloseConnection = vi.fn();

      const bleManager = createMockBleManager({
        connectedDevices: vi.fn().mockResolvedValue([]),
        startDeviceScan: startScan,
        stopDeviceScan: stopScan,
        connectToDevice: vi.fn().mockResolvedValueOnce(mockDevice),
        discoverAllServicesAndCharacteristicsForDevice: vi
          .fn()
          .mockResolvedValueOnce(mockDevice),
        monitorCharacteristicForDevice: vi.fn(),
        writeCharacteristicWithoutResponseForDevice: vi.fn(),
        onDeviceDisconnected,
        isDeviceConnected: vi.fn(),
        onStateChange: (listener: (state: State) => void) => {
          listener(State.PoweredOn);
          return { remove: vi.fn() };
        },
      });

      const deviceConnectionStateMachineFactory = (
        _args: DeviceConnectionStateMachineParams<RNBleApduSenderDependencies>,
      ) => {
        return new DeviceConnectionStateMachine({
          deviceId: "deviceId",
          deviceApduSender: _args.deviceApduSender,
          timeoutDuration: 1000,
          onTerminated: _args.onTerminated,
          tryToReconnect: _args.tryToReconnect,
        });
      };

      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: vi.fn().mockResolvedValue(undefined),
        closeConnection: fakeCloseConnection,
      });

      const transport = new TestTransportBuilder()
        .withBleManager(bleManager)
        .withPlatform(IOS_PLATFORM)
        .withDeviceModelDataSource(
          createFakeDataSource() as unknown as DeviceModelDataSource,
        )
        .withDeviceConnectionStateMachineFactory(
          deviceConnectionStateMachineFactory,
        )
        .withDeviceApduSenderFactory(deviceApduSenderFactory)
        .build();

      const fakeOnDisconnect = vi.fn();

      // Start listening to devices
      const observable = transport.listenToAvailableDevices();

      // Advance timers to trigger the throttleTime and allow scan results to be emitted
      vi.advanceTimersByTime(2000);

      const devices = await firstValueFrom(observable);
      const [device] = devices;
      const result = await transport.connect({
        deviceId: device!.id,
        onDisconnect: fakeOnDisconnect,
      });

      const res = await transport.disconnect({
        connectedDevice: result.extract() as TransportConnectedDevice,
      });

      expect(res).toEqual(Right(undefined));
      expect(fakeOnDisconnect).toHaveBeenCalled();
    });
  });
});
