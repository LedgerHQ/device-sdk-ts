/* eslint @typescript-eslint/consistent-type-imports: off */
import { PermissionsAndroid, type Platform } from "react-native";
import { type PermissionStatus } from "react-native/Libraries/PermissionsAndroid/PermissionsAndroid";
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
import { lastValueFrom, Subscription, take } from "rxjs";
import { beforeEach, expect } from "vitest";

import { PermissionsAndroidNarrowedType } from "./PermissionsAndroidNarrowedType";
import { type RNBleApduSenderDependencies } from "./RNBleApduSender";
import { RNBleTransport, RNBleTransportFactory } from "./RNBleTransport";

// ===== MOCKS =====
const fakeLogger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
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
  private permissionsAndroid: PermissionsAndroidNarrowedType =
    {} as unknown as PermissionsAndroidNarrowedType;
  private deviceConnectionStateMachineFactory?: (
    args: DeviceConnectionStateMachineParams<RNBleApduSenderDependencies>,
  ) => DeviceConnectionStateMachine<RNBleApduSenderDependencies>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deviceApduSenderFactory?: (args: any, loggerFactory: any) => any;

  withDeviceModelDataSource(dataSource: DeviceModelDataSource) {
    this.deviceModelDataSource = dataSource;
    return this;
  }

  withPlatform(platform: Platform) {
    this.platform = platform;
    return this;
  }

  withPermissionsAndroid(permissions: PermissionsAndroidNarrowedType) {
    this.permissionsAndroid = permissions;
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

  build(): RNBleTransport {
    return new RNBleTransport(
      this.deviceModelDataSource,
      this.loggerServiceFactory,
      this.apduSenderServiceFactory,
      this.apduReceiverServiceFactory,
      this.bleManager,
      this.platform,
      this.permissionsAndroid,
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

function createMockBleManager(overrides: Partial<BleManager> = {}): BleManager {
  const mockBleManager = {
    onStateChange: vi.fn(),
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
    ...overrides,
  } as unknown as BleManager;

  return mockBleManager;
}

function createMockPermissionsAndroid(
  overrides: Partial<PermissionsAndroid> = {},
): PermissionsAndroidNarrowedType {
  return {
    request: vi.fn(),
    requestMultiple: vi.fn(),
    check: vi.fn(),
    PERMISSIONS: {
      ACCESS_COARSE_LOCATION: "android.permission.ACCESS_COARSE_LOCATION",
      ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION",
      BLUETOOTH_SCAN: "android.permission.BLUETOOTH_SCAN",
      BLUETOOTH_CONNECT: "android.permission.BLUETOOTH_CONNECT",
    },
    RESULTS: {
      GRANTED: "granted",
      DENIED: "denied",
      NEVER_ASK_AGAIN: "never_ask_again",
    },
    ...overrides,
  } as unknown as PermissionsAndroidNarrowedType;
}

// ===== ANDROID PERMISSION TEST HELPER =====
async function testAndroidPermissions(
  params: {
    version: number;
    requestPermissionResult: {
      "android.permission.BLUETOOTH_CONNECT": PermissionStatus;
      "android.permission.BLUETOOTH_SCAN": PermissionStatus;
      "android.permission.ACCESS_FINE_LOCATION": PermissionStatus;
    };
    accessFineLocationResult?: PermissionStatus;
  },
  expects: {
    result: boolean;
    callRequestPermission: boolean;
  },
) {
  const platform = {
    OS: "android" as const,
    Version: params.version,
  } as Platform;
  const permissionsAndroid = createMockPermissionsAndroid({
    check: vi.fn().mockResolvedValue(false),
    request: vi.fn().mockImplementation((key: string) =>
      Promise.resolve(
        {
          ACCESS_FINE_LOCATION: params.accessFineLocationResult,
        }[key],
      ),
    ),
    requestMultiple: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(params.requestPermissionResult),
      ),
  });

  const transport = new TestTransportBuilder()
    .withPlatform(platform as Platform)
    .withPermissionsAndroid(permissionsAndroid)
    .build();

  const result = await transport.checkAndRequestPermissions();

  if (expects.callRequestPermission) {
    expect(permissionsAndroid.request).toHaveBeenCalledWith(
      "ACCESS_FINE_LOCATION",
    );
  }
  expect(result).toBe(expects.result);
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
  });

  afterEach(() => {
    if (subscription) {
      subscription.unsubscribe();
    }
  });

  describe("getIdentifier", () => {
    it("should return rnBleTransportIdentifier", () => {
      const transport = new TestTransportBuilder().build();
      const identifier = transport.getIdentifier();
      expect(identifier).toStrictEqual("RN_BLE");
    });
  });

  describe("isSupported", () => {
    it("should return true if platform is ios", async () => {
      const transport = new TestTransportBuilder()
        .withPlatform(IOS_PLATFORM)
        .build();

      const isSupported = transport.isSupported();

      expect(isSupported).toBe(true);
    });

    it("should return true if platform is android", async () => {
      const transport = new TestTransportBuilder()
        .withPlatform(ANDROID_PLATFORM as Platform)
        .build();

      const isSupported = transport.isSupported();

      expect(isSupported).toBe(true);
    });

    it("should return false if platform is not android nor ios", async () => {
      const transport = new TestTransportBuilder()
        .withPlatform(WINDOWS_PLATFORM)
        .build();

      const isSupported = transport.isSupported();

      expect(isSupported).toBe(false);
    });
  });

  describe("checkAndRequestPermissions", () => {
    // it("should return true if platform is android and apiLevel < 31 with good permissions", async () => {
    //   await testAndroidPermissions(
    //     {
    //       version: 30,
    //       requestPermissionResult: {
    //         "android.permission.BLUETOOTH_CONNECT": "granted",
    //         "android.permission.BLUETOOTH_SCAN": "granted",
    //       },
    //     },
    //     {
    //       result: true,
    //       callRequestPermission: false,
    //     },
    //   );
    // });

    it("should return true if platform is android and apiLevel >= 31 with good permissions", async () => {
      await testAndroidPermissions(
        {
          version: 31,
          requestPermissionResult: {
            "android.permission.BLUETOOTH_CONNECT": "granted",
            "android.permission.BLUETOOTH_SCAN": "granted",
            "android.permission.ACCESS_FINE_LOCATION": "granted",
          },
        },
        {
          result: true,
          callRequestPermission: false,
        },
      );
    });

    it("should return false if platform is android with bad permissions", async () => {
      await testAndroidPermissions(
        {
          version: 31,
          requestPermissionResult: {
            "android.permission.ACCESS_FINE_LOCATION": "denied",
            "android.permission.BLUETOOTH_CONNECT": "granted",
            "android.permission.BLUETOOTH_SCAN": "granted",
          },
        },
        {
          result: false,
          callRequestPermission: false,
        },
      );
    });

    it("should return false if platform is android and denied permissions", async () => {
      await testAndroidPermissions(
        {
          version: 31,
          requestPermissionResult: {
            "android.permission.BLUETOOTH_CONNECT": "denied",
            "android.permission.BLUETOOTH_SCAN": "denied",
            "android.permission.ACCESS_FINE_LOCATION": "denied",
          },
        },
        {
          result: false,
          callRequestPermission: false,
        },
      );
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
    it("should return already connected devices and scanned devices", () =>
      new Promise((done, reject) => {
        let scanInterval: NodeJS.Timeout | null = null;

        const connectedDevice = createMockDevice({
          id: "aConnectedDeviceId",
          localName: "aConnectedDeviceName",
        });

        const startScan = vi
          .fn()
          .mockImplementation((_uuids, _options, listener) => {
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
      let scanInterval: NodeJS.Timeout | null = null;
      const mockDevice = createMockDevice({
        id: "deviceId",
        localName: "name",
      });

      const startScan = vi
        .fn()
        .mockImplementation((_uuids, _options, listener) => {
          scanInterval = setInterval(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            listener(null, {
              id: "deviceId",
              localName: "name",
              serviceUUIDs: ["ledgerId"],
              rssi: 42,
            });
          }, 500);

          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          listener(null, {
            id: "43",
            localName: "name43",
            serviceUUIDs: ["notLedgerId"],
            rssi: 43,
          });
        });

      const stopScan = vi.fn().mockImplementation(() => {
        if (scanInterval) {
          clearInterval(scanInterval);
          scanInterval = null;
        }
      });

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
        .build();

      const [device] = await lastValueFrom(
        transport.listenToAvailableDevices().pipe(take(3)),
      );

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
      let scanInterval: NodeJS.Timeout | null = null;
      const mockDevice = createMockDevice({
        id: "deviceId",
        localName: "name",
      });

      const startScan = vi
        .fn()
        .mockImplementation((_uuids, _options, listener) => {
          scanInterval = setInterval(() => {
            listener(null, {
              id: "deviceId",
              localName: "name",
              serviceUUIDs: ["ledgerId"],
              rssi: 42,
            });
          }, 100);
        });

      const stopScan = vi.fn().mockImplementation(() => {
        if (scanInterval) {
          clearInterval(scanInterval);
          scanInterval = null;
        }
      });

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

      const [device] = await lastValueFrom(
        transport.listenToAvailableDevices().pipe(take(3)),
      );

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
          }),
        ),
      );
      expect(fakeSendApdu).toHaveBeenCalledWith(Uint8Array.from([0x43, 0x32]));
    });
  });

  describe("disconnect", () => {
    it("should disconnect gracefully", async () => {
      let scanInterval: NodeJS.Timeout | null = null;
      const mockDevice = createMockDevice({
        id: "deviceId",
        localName: "name",
      });

      const startScan = vi
        .fn()
        .mockImplementation((_uuids, _options, listener) => {
          scanInterval = setInterval(() => {
            listener(null, {
              id: "deviceId",
              localName: "name",
              serviceUUIDs: ["ledgerId"],
              rssi: 42,
            });
          }, 100);
        });

      const stopScan = vi.fn().mockImplementation(() => {
        if (scanInterval) {
          clearInterval(scanInterval);
          scanInterval = null;
        }
      });

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

      const [device] = await lastValueFrom(
        transport.listenToAvailableDevices().pipe(take(3)),
      );

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
      let scanInterval: NodeJS.Timeout | null = null;
      const mockDevice = createMockDevice({
        id: "deviceId",
        localName: "name",
      });

      const startScan = vi
        .fn()
        .mockImplementation((_uuids, _options, listener) => {
          scanInterval = setInterval(() => {
            listener(null, {
              id: "deviceId",
              localName: "name",
              serviceUUIDs: ["ledgerId"],
              rssi: 42,
            });
          }, 100);
        });

      const stopScan = vi.fn().mockImplementation(() => {
        if (scanInterval) {
          clearInterval(scanInterval);
          scanInterval = null;
        }
      });

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

      const [device] = await lastValueFrom(
        transport.listenToAvailableDevices().pipe(take(3)),
      );
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
