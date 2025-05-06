/* eslint @typescript-eslint/consistent-type-imports: off */
import { type PermissionsAndroid, type Platform } from "react-native";
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
import { beforeEach, expect, type Mock } from "vitest";

import { BleNotSupported } from "@api/model/Errors";

import { type RNBleApduSenderDependencies } from "./RNBleApduSender";
import { RNBleTransport, RNBleTransportFactory } from "./RNBleTransport";

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

const expectAndroidSupportedResult = async (
  params: {
    version: number;
    permissions: Record<string, string>;
    requestPermissionResult: {
      "android.permission.BLUETOOTH_CONNECT": PermissionStatus;
      "android.permission.BLUETOOTH_SCAN": PermissionStatus;
      "android.permission.ACCESS_FINE_LOCATION": PermissionStatus;
    };
    accessFineLocationResult?: PermissionStatus;
  },
  expects: {
    isSupported: boolean;
    callRequestPermission: boolean;
  },
) => {
  // given
  const platform = { OS: "android", Version: params.version };
  const permissionsAndroid = {
    request: vi.fn().mockImplementation((key: string) =>
      Promise.resolve(
        {
          ACCESS_FINE_LOCATION: params.accessFineLocationResult,
        }[key],
      ),
    ),
    PERMISSIONS: params.permissions,
    RESULTS: {
      GRANTED: "granted",
    },
    requestMultiple: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(params.requestPermissionResult),
      ),
  };
  const transport = new RNBleTransport(
    "DeviceModelDataSource" as unknown as DeviceModelDataSource,
    () => fakeLogger as unknown as LoggerPublisherService,
    (() => {}) as unknown as ApduSenderServiceFactory,
    (() => {}) as unknown as ApduReceiverServiceFactory,
    new BleManager(),
    platform as Platform,
    permissionsAndroid as unknown as PermissionsAndroid,
  );
  // when
  await transport.requestPermission();
  const isSupported = transport.isSupported();
  // then
  if (expects.callRequestPermission) {
    expect(permissionsAndroid.request).toHaveBeenCalledWith(
      "ACCESS_FINE_LOCATION",
    );
  }
  expect(isSupported).toBe(expects.isSupported);
};

describe("RNBleTransportFactory", () => {
  it("should return a RNBleTransport", () => {
    const fakeArgs = {
      deviceModelDataSource:
        "DeviceModelDataSource" as unknown as DeviceModelDataSource,
      loggerServiceFactory: () =>
        fakeLogger as unknown as LoggerPublisherService,
      apduSenderServiceFactory:
        (() => {}) as unknown as ApduSenderServiceFactory,
      apduReceiverServiceFactory:
        (() => {}) as unknown as ApduReceiverServiceFactory,
      config: {} as DmkConfig,
    };
    // when
    const transport = RNBleTransportFactory(fakeArgs);
    // then
    expect(transport).toBeInstanceOf(RNBleTransport);
  });
});

describe("RNBleTransport", () => {
  const fakePlaftorm = { OS: "ios" };
  const fakeDeviceModel = new TransportDeviceModel({
    id: DeviceModelId.FLEX,
    productName: "Ledger Flex",
    usbProductId: 0x70,
    bootloaderUsbProductId: 0x0007,
    usbOnly: false,
    memorySize: 1533 * 1024,
    blockSize: 32,
    masks: [0x33300000],
  });
  const getBluetoothServicesMock = vi.fn(() => ["ledgerId"]);
  const getBluetoothServicesInfosMock = vi.fn(() => ({
    ledgerId: new BleDeviceInfos(
      fakeDeviceModel,
      "serviceUuid",
      "notifyUuid",
      "writeCmdUuid",
      "readCmdUuid",
    ),
  }));
  const fakeDataSource = {
    getBluetoothServices: getBluetoothServicesMock,
    getBluetoothServicesInfos: getBluetoothServicesInfosMock,
  };

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
      // given
      const bleManager = new BleManager();
      const transport = new RNBleTransport(
        "DeviceModelDataSource" as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
      );

      // when
      const identifier = transport.getIdentifier();

      // then
      expect(identifier).toStrictEqual("RN_BLE");
    });
  });

  describe("isSupported", () => {
    it("should return true if platform is ios", async () => {
      // given
      const platform = { OS: "ios" };
      const bleManager = new BleManager();
      const transport = new RNBleTransport(
        "DeviceModelDataSource" as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
        platform as Platform,
      );

      // when
      await transport.requestPermission();
      const isSupported = transport.isSupported();

      // then
      expect(isSupported).toBe(true);
    });

    it("should return true if platform is android and apiLevel < 31 with good permissions", async () => {
      await expectAndroidSupportedResult(
        {
          version: 30,
          permissions: {
            ACCESS_FINE_LOCATION: "ACCESS_FINE_LOCATION",
            BLUETOOTH_SCAN: "BLUETOOTH_SCAN",
            BLUETOOTH_CONNECT: "BLUETOOTH_CONNECT",
          },
          requestPermissionResult: {
            "android.permission.BLUETOOTH_CONNECT": "granted",
            "android.permission.BLUETOOTH_SCAN": "granted",
            "android.permission.ACCESS_FINE_LOCATION": "granted",
          },
        },
        {
          isSupported: true,
          callRequestPermission: true,
        },
      );
    });

    it("should return true if platform is android and apiLevel >= 31 with good permissions", async () => {
      await expectAndroidSupportedResult(
        {
          version: 31,
          permissions: {
            ACCESS_FINE_LOCATION: "ACCESS_FINE_LOCATION",
            BLUETOOTH_SCAN: "BLUETOOTH_SCAN",
            BLUETOOTH_CONNECT: "BLUETOOTH_CONNECT",
          },
          requestPermissionResult: {
            "android.permission.BLUETOOTH_CONNECT": "granted",
            "android.permission.BLUETOOTH_SCAN": "granted",
            "android.permission.ACCESS_FINE_LOCATION": "granted",
          },
        },
        {
          isSupported: true,
          callRequestPermission: false,
        },
      );
    });

    it("should return false if platform is android with bad permissions", async () => {
      await expectAndroidSupportedResult(
        {
          version: 31,
          permissions: {
            ACCESS_FINE_LOCATION: "",
            BLUETOOTH_SCAN: "",
            BLUETOOTH_CONNECT: "BLUETOOTH_CONNECT",
          },
          requestPermissionResult: {
            "android.permission.ACCESS_FINE_LOCATION": "denied",
            "android.permission.BLUETOOTH_CONNECT": "granted",
            "android.permission.BLUETOOTH_SCAN": "granted",
          },
        },
        {
          isSupported: false,
          callRequestPermission: false,
        },
      );
    });

    it("should return false if platform is android and denied permissions", async () => {
      await expectAndroidSupportedResult(
        {
          version: 31,
          permissions: {
            ACCESS_FINE_LOCATION: "ACCESS_FINE_LOCATION",
            BLUETOOTH_SCAN: "BLUETOOTH_SCAN",
            BLUETOOTH_CONNECT: "BLUETOOTH_CONNECT",
          },
          requestPermissionResult: {
            "android.permission.BLUETOOTH_CONNECT": "denied",
            "android.permission.BLUETOOTH_SCAN": "denied",
            "android.permission.ACCESS_FINE_LOCATION": "denied",
          },
        },
        {
          isSupported: false,
          callRequestPermission: false,
        },
      );
    });

    it("should return false if platform isn't android nor ios", async () => {
      // given
      const bleManager = new BleManager();
      const transport = new RNBleTransport(
        "DeviceModelDataSource" as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
        { OS: "windows" } as Platform,
      );

      // when
      await transport.requestPermission();
      const isSupported = transport.isSupported();

      // then
      expect(isSupported).toBe(false);
    });
  });

  // startDiscovering is not used / implemented anymore and just returns a from([])
  describe("startDiscovering", () => {
    it("should throw error if transport is not supported", () => {
      // given
      const platform = { OS: "windows" };
      const bleManager = new BleManager();

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
        platform as Platform,
      );

      try {
        // when
        transport.startDiscovering();
      } catch (e) {
        // then
        expect(e).toBeInstanceOf(BleNotSupported);
      }
    });

    it("should emit an empty array", () =>
      new Promise((done) => {
        // given
        const bleManager = new BleManager();

        const transport = new RNBleTransport(
          fakeDataSource as unknown as DeviceModelDataSource,
          () => fakeLogger as unknown as LoggerPublisherService,
          (() => {}) as unknown as ApduSenderServiceFactory,
          (() => {}) as unknown as ApduReceiverServiceFactory,
          bleManager,
          fakePlaftorm as Platform,
          {} as unknown as PermissionsAndroid,
        );

        // when
        const observable = transport.startDiscovering();

        // then
        subscription = observable.subscribe({
          next: (discoveredDevice) => {
            expect(discoveredDevice).toStrictEqual([]);
            done(undefined);
          },
          error: (e) => {
            throw e;
          },
          complete: () => {
            // Will complete as we use from([])
            done(undefined);
          },
        });
      }));

    it.skip("should emit discovered new device", () =>
      new Promise((done) => {
        // given
        let scanInterval: NodeJS.Timeout | null = null;

        const bleManager = new BleManager();
        const startScan = vi
          .fn()
          .mockImplementation((_uuids, _options, listener) => {
            scanInterval = setInterval(() => {
              listener(null, {
                id: "id",
                localName: "name",
                serviceUUIDs: ["ledgerId"],
                rssi: 42,
              });
            }, 500);

            listener(null, {
              id: "43",
              localName: "name43",
              serviceUUIDs: ["notLedgerId"],
              rssi: 43,
            });

            return Promise.resolve();
          });

        const stopScan = vi.fn().mockImplementation(() => {
          if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
          }
          return Promise.resolve();
        });

        vi.spyOn(bleManager, "connectedDevices").mockResolvedValueOnce([]);
        vi.spyOn(bleManager, "startDeviceScan").mockImplementation(startScan);
        vi.spyOn(bleManager, "stopDeviceScan").mockImplementation(stopScan);

        const transport = new RNBleTransport(
          fakeDataSource as unknown as DeviceModelDataSource,
          () => fakeLogger as unknown as LoggerPublisherService,
          (() => {}) as unknown as ApduSenderServiceFactory,
          (() => {}) as unknown as ApduReceiverServiceFactory,
          bleManager,
          fakePlaftorm as Platform,
          {} as unknown as PermissionsAndroid,
        );

        // when
        const observable = transport.startDiscovering();

        // then
        subscription = observable.subscribe({
          next: (discoveredDevice) => {
            expect(discoveredDevice).toStrictEqual([]);
            done(undefined);
          },
          error: (e) => {
            throw e;
          },
          complete: () => {
            throw new Error("complete should not be called");
          },
        });
      }));

    it.skip("should emit both known and new device", () =>
      new Promise((done) => {
        // given
        let scanInterval: NodeJS.Timeout | null = null;

        const bleManager = new BleManager();
        const mockDevice = {
          readRSSI: vi.fn().mockResolvedValueOnce({
            discoverAllServicesAndCharacteristics: vi
              .fn()
              .mockResolvedValueOnce({
                services: vi.fn().mockResolvedValueOnce({}),
                serviceUUIDs: ["ledgerId"],
                rssi: 64,
                id: "knownDeviceId",
                localName: "knownDeviceName",
              }),
          }),
        } as unknown as Device;

        const startScan = vi
          .fn()
          .mockImplementation((_uuids, _options, listener) => {
            scanInterval = setInterval(() => {
              listener(null, {
                id: "newDeviceId",
                localName: "newDeviceName",
                serviceUUIDs: ["ledgerId"],
                rssi: 42,
              } as unknown as Device);
            }, 500);

            listener(null, {
              id: "43",
              localName: "name43",
              serviceUUIDs: ["notLedgerId"],
              rssi: 43,
            } as unknown as Device);

            return Promise.resolve();
          });

        const stopScan = vi.fn().mockImplementation(() => {
          if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
          }
          return Promise.resolve();
        });

        vi.spyOn(bleManager, "connectedDevices").mockResolvedValueOnce([
          mockDevice,
        ]);
        vi.spyOn(bleManager, "startDeviceScan").mockImplementation(startScan);
        vi.spyOn(bleManager, "stopDeviceScan").mockImplementation(stopScan);
        vi.spyOn(bleManager, "onDeviceDisconnected").mockImplementation(
          vi.fn(),
        );

        const transport = new RNBleTransport(
          fakeDataSource as unknown as DeviceModelDataSource,
          () => fakeLogger as unknown as LoggerPublisherService,
          (() => {}) as unknown as ApduSenderServiceFactory,
          (() => {}) as unknown as ApduReceiverServiceFactory,
          bleManager,
          fakePlaftorm as Platform,
          {} as unknown as PermissionsAndroid,
        );

        // when
        const obs = transport.startDiscovering();
        const discoveredDevices: Record<string, TransportDiscoveredDevice> = {};

        // then
        subscription = obs.subscribe({
          next: (device) => {
            discoveredDevices[device.id] = device;
            if (Object.values(discoveredDevices).length === 2) {
              expect(Object.values(discoveredDevices)).toStrictEqual([
                {
                  id: "knownDeviceId",
                  name: "knownDeviceName",
                  deviceModel: fakeDeviceModel,
                  transport: "RN_BLE",
                  rssi: 64,
                },
                {
                  id: "newDeviceId",
                  name: "newDeviceName",
                  deviceModel: fakeDeviceModel,
                  transport: "RN_BLE",
                  rssi: 42,
                },
              ]);
              done(undefined);
            }
          },
        });
      }));
  });

  describe("stopDiscovering", () => {
    it("should call ble manager stop scan on stop discovering", () => {
      // given
      const bleManager = new BleManager();
      const stopDeviceScan = vi.fn();
      vi.spyOn(bleManager, "connectedDevices").mockResolvedValueOnce([]);
      vi.spyOn(bleManager, "stopDeviceScan").mockImplementation(stopDeviceScan);

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
      );

      // when
      transport.stopDiscovering();

      // then
      expect(stopDeviceScan).toHaveBeenCalled();
    });

    it.skip("should call ble manager stop scan when unsubscribe startDiscovering obs", () => {
      // given
      let scanInterval: NodeJS.Timeout | null = null;

      const bleManager = new BleManager();
      const startScan = vi
        .fn()
        .mockImplementation((_uuids, _options, listener) => {
          scanInterval = setInterval(() => {
            listener(null, {
              id: "id",
              localName: "name",
              serviceUUIDs: ["ledgerId"],
              rssi: 42,
            });
          }, 500);
          listener(null, {
            id: "43",
            localName: "name43",
            serviceUUIDs: ["notLedgerId"],
            rssi: 43,
          });

          return Promise.resolve();
        });

      const stopScan = vi.fn().mockImplementation(() => {
        if (scanInterval) {
          clearInterval(scanInterval);
          scanInterval = null;
        }
        return Promise.resolve();
      });

      vi.spyOn(bleManager, "connectedDevices").mockResolvedValueOnce([]);
      vi.spyOn(bleManager, "startDeviceScan").mockImplementation(startScan);
      vi.spyOn(bleManager, "stopDeviceScan").mockImplementation(stopScan);
      vi.spyOn(bleManager, "onDeviceDisconnected").mockImplementation(vi.fn());

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
      );

      // when
      transport.startDiscovering().subscribe().unsubscribe();

      // then
      expect(startScan).toHaveBeenCalled();
      expect(stopScan).toHaveBeenCalled();
    });
  });

  describe("listenToAvailableDevices", () => {
    it("should call startScan and connectedDevices from ble manager", () =>
      new Promise((done) => {
        // given
        let scanInterval: NodeJS.Timeout | null = null;

        const bleManager = new BleManager();
        const mockDevice = {
          readRSSI: vi.fn().mockResolvedValueOnce({
            discoverAllServicesAndCharacteristics: vi
              .fn()
              .mockResolvedValueOnce({
                services: vi.fn().mockResolvedValueOnce({}),
                serviceUUIDs: ["ledgerId"],
                rssi: 64,
                id: "knownDeviceId",
                localName: "knownDeviceName",
              }),
          }),
        } as unknown as Device;

        const startScan = vi
          .fn()
          .mockImplementation((_uuids, _options, listener) => {
            scanInterval = setInterval(() => {
              listener(null, {
                id: "id",
                localName: "name",
                serviceUUIDs: ["ledgerId"],
                rssi: 42,
              });
            }, 10);

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

        vi.spyOn(bleManager, "connectedDevices").mockResolvedValueOnce([
          mockDevice,
        ]);
        vi.spyOn(bleManager, "startDeviceScan").mockImplementation(startScan);
        vi.spyOn(bleManager, "stopDeviceScan").mockImplementation(stopScan);
        vi.spyOn(bleManager, "onDeviceDisconnected").mockImplementation(
          vi.fn(),
        );
        vi.spyOn(bleManager, "isDeviceConnected").mockImplementation(vi.fn());
        vi.spyOn(bleManager, "onStateChange").mockImplementation(
          (listener: (state: State) => void) => {
            listener(State.PoweredOn);
            return {
              remove: vi.fn(),
            };
          },
        );

        const transport = new RNBleTransport(
          fakeDataSource as unknown as DeviceModelDataSource,
          () => fakeLogger as unknown as LoggerPublisherService,
          (() => {}) as unknown as ApduSenderServiceFactory,
          (() => {}) as unknown as ApduReceiverServiceFactory,
          bleManager,
          fakePlaftorm as Platform,
          {} as unknown as PermissionsAndroid,
        );

        // when
        subscription = transport.listenToAvailableDevices().subscribe({
          next: (devices) => {
            if (devices.length === 1) {
              // then
              expect(devices).toEqual([
                {
                  id: "id",
                  name: "name",
                  deviceModel: fakeDeviceModel,
                  transport: "RN_BLE",
                  rssi: 42,
                },
              ]);
              done(undefined);
            }
          },
        });
      }));
  });

  describe("connect", () => {
    let fakeConnectedDevices: Mock;

    beforeEach(() => {
      fakeConnectedDevices = vi.fn().mockResolvedValueOnce([
        {
          readRSSI: vi.fn().mockResolvedValueOnce({
            discoverAllServicesAndCharacteristics: vi
              .fn()
              .mockResolvedValueOnce({
                services: vi.fn().mockResolvedValueOnce({}),
                serviceUUIDs: ["ledgerId"],
                rssi: 64,
                id: "deviceId",
                localName: "knownDeviceName",
              }),
          }),
        },
      ]);
    });

    it("should throw an error if device id is unknown", async () => {
      // given
      const bleManager = new BleManager();

      vi.spyOn(bleManager, "connectedDevices").mockImplementation(
        fakeConnectedDevices,
      );

      vi.spyOn(
        bleManager,
        "discoverAllServicesAndCharacteristicsForDevice",
      ).mockRejectedValueOnce(
        new Error("discoverAllServicesAndCharacteristicsForDevice error"),
      );

      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: vi.fn().mockResolvedValue(undefined),
      });

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        vi.fn(),
        deviceApduSenderFactory,
      );

      // when
      const result = await transport.connect({
        // @ts-expect-error test case
        deviceId: null,
        onDisconnect: vi.fn(),
      });

      // then
      expect(result).toEqual(
        Left(
          new OpeningConnectionError(
            `discoverAllServicesAndCharacteristicsForDevice error`,
          ),
        ),
      );
    });

    it("should connect to a discovered device with correct MTU and discover services and setup apdu sender", async () => {
      // given
      let scanInterval: NodeJS.Timeout | null = null;
      const bleManager = new BleManager();
      const mockDevice = {
        readRSSI: vi.fn().mockResolvedValueOnce({
          discoverAllServicesAndCharacteristics: vi.fn().mockResolvedValueOnce({
            services: vi.fn().mockResolvedValueOnce({}),
            serviceUUIDs: ["ledgerId"],
            rssi: 64,
            id: "knownDeviceId",
            localName: "knownDeviceName",
          }),
        }),
        services: vi.fn().mockResolvedValueOnce([
          {
            uuid: "ledgerId",
          },
        ]),
      } as unknown as Device;

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
          }, 500);

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

      vi.spyOn(bleManager, "connectedDevices").mockImplementation(
        fakeConnectedDevices,
      );
      vi.spyOn(bleManager, "startDeviceScan").mockImplementation(startScan);
      vi.spyOn(bleManager, "stopDeviceScan").mockImplementation(stopScan);
      vi.spyOn(bleManager, "connectToDevice").mockResolvedValueOnce(mockDevice);
      vi.spyOn(
        bleManager,
        "discoverAllServicesAndCharacteristicsForDevice",
      ).mockResolvedValueOnce(mockDevice);
      vi.spyOn(bleManager, "monitorCharacteristicForDevice").mockImplementation(
        vi.fn(),
      );
      vi.spyOn(
        bleManager,
        "writeCharacteristicWithoutResponseForDevice",
      ).mockImplementation(vi.fn());
      vi.spyOn(bleManager, "onDeviceDisconnected").mockImplementation(vi.fn());
      vi.spyOn(bleManager, "isDeviceConnected").mockImplementation(vi.fn());
      vi.spyOn(bleManager, "onStateChange").mockImplementation(
        (listener: (state: State) => void) => {
          listener(State.PoweredOn);
          return {
            remove: vi.fn(),
          };
        },
      );

      const fakeSetupConnection = vi.fn().mockResolvedValue(undefined);
      const deviceConnectionStateMachineFactory = vi.fn().mockReturnValue({
        sendApdu: vi.fn(),
      });
      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: fakeSetupConnection,
      });

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        deviceConnectionStateMachineFactory,
        deviceApduSenderFactory,
      );

      // when
      const [device] = await lastValueFrom(
        transport.listenToAvailableDevices().pipe(take(3)),
      );

      const result = await transport.connect({
        deviceId: device!.id,
        onDisconnect: vi.fn(),
      });

      // then
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
      // given
      let scanInterval: NodeJS.Timeout | null = null;
      const bleManager = new BleManager();
      const mockDevice = {
        id: "deviceId",
        readRSSI: vi.fn().mockResolvedValueOnce({
          discoverAllServicesAndCharacteristics: vi.fn().mockResolvedValueOnce({
            services: vi.fn().mockResolvedValueOnce({}),
            serviceUUIDs: ["ledgerId"],
            rssi: 64,
            id: "knownDeviceId",
            localName: "knownDeviceName",
          }),
        }),
        services: vi.fn().mockResolvedValueOnce([
          {
            uuid: "ledgerId",
          },
        ]),
      } as unknown as Device;

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

      vi.spyOn(bleManager, "connectedDevices").mockImplementation(
        fakeConnectedDevices,
      );
      vi.spyOn(bleManager, "startDeviceScan").mockImplementation(startScan);
      vi.spyOn(bleManager, "stopDeviceScan").mockImplementation(stopScan);
      vi.spyOn(bleManager, "connectToDevice").mockResolvedValueOnce(mockDevice);
      vi.spyOn(
        bleManager,
        "discoverAllServicesAndCharacteristicsForDevice",
      ).mockResolvedValueOnce(mockDevice);
      vi.spyOn(bleManager, "monitorCharacteristicForDevice").mockImplementation(
        vi.fn(),
      );
      vi.spyOn(
        bleManager,
        "writeCharacteristicWithoutResponseForDevice",
      ).mockImplementation(vi.fn());
      vi.spyOn(bleManager, "onDeviceDisconnected").mockImplementation(vi.fn());
      vi.spyOn(bleManager, "isDeviceConnected").mockImplementation(vi.fn());
      vi.spyOn(bleManager, "onStateChange").mockImplementation(
        (listener: (state: State) => void) => {
          listener(State.PoweredOn);
          return {
            remove: vi.fn(),
          };
        },
      );

      const fakeSendApdu = vi.fn();
      const deviceConnectionStateMachineFactory = vi.fn().mockReturnValue({
        sendApdu: fakeSendApdu,
      });
      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: vi.fn().mockResolvedValue(undefined),
      });

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        deviceConnectionStateMachineFactory,
        deviceApduSenderFactory,
      );

      // when
      const [device] = await lastValueFrom(
        transport.listenToAvailableDevices().pipe(take(3)),
      );

      const result = await transport.connect({
        deviceId: device!.id,
        onDisconnect: vi.fn(),
      });

      const connectedDevice = result.extract() as TransportConnectedDevice;
      connectedDevice.sendApdu(Uint8Array.from([0x43, 0x32]));
      // then
      expect(result).toEqual(
        Right(
          new TransportConnectedDevice({
            id: "deviceId",
            deviceModel: fakeDeviceModel,
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
    let fakeConnectedDevices: Mock;

    beforeEach(() => {
      fakeConnectedDevices = vi.fn().mockResolvedValue([
        {
          readRSSI: vi.fn().mockResolvedValueOnce({
            discoverAllServicesAndCharacteristics: vi
              .fn()
              .mockResolvedValueOnce({
                services: vi.fn().mockResolvedValueOnce({}),
                serviceUUIDs: ["ledgerId"],
                rssi: 64,
                id: "deviceId",
                localName: "knownDeviceName",
              }),
          }),
        },
      ]);
    });

    it("should disconnect gracefully", async () => {
      let scanInterval: NodeJS.Timeout | null = null;
      const bleManager = new BleManager();
      const mockDevice = {
        id: "deviceId",
        readRSSI: vi.fn().mockResolvedValueOnce({
          discoverAllServicesAndCharacteristics: vi.fn().mockResolvedValueOnce({
            services: vi.fn().mockResolvedValueOnce({}),
            serviceUUIDs: ["ledgerId"],
            rssi: 64,
            id: "knownDeviceId",
            localName: "knownDeviceName",
          }),
        }),
        services: vi.fn().mockResolvedValueOnce([
          {
            uuid: "ledgerId",
          },
        ]),
      } as unknown as Device;

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

      const onDeviceDisconnected = vi
        .fn()
        .mockImplementation((_id, callback) => {
          callback(null, {
            deviceId: "deviceId",
            connect: vi.fn().mockResolvedValue({
              services: vi.fn().mockResolvedValueOnce({}),
              serviceUUIDs: ["ledgerId"],
              rssi: 64,
              id: "deviceId",
              localName: "knownDeviceName",
            }),
            discoverAllServicesAndCharacteristics: vi
              .fn()
              .mockResolvedValueOnce({
                services: vi.fn().mockResolvedValueOnce({}),
                serviceUUIDs: ["ledgerId"],
                rssi: 64,
                id: "deviceId",
                localName: "knownDeviceName",
              }),
          });
          return { remove: vi.fn() };
        });

      const fakeCloseConnection = vi.fn();

      vi.spyOn(bleManager, "connectedDevices").mockImplementation(
        fakeConnectedDevices,
      );
      vi.spyOn(bleManager, "startDeviceScan").mockImplementation(startScan);
      vi.spyOn(bleManager, "stopDeviceScan").mockImplementation(stopScan);
      vi.spyOn(bleManager, "connectToDevice").mockResolvedValueOnce(mockDevice);
      vi.spyOn(
        bleManager,
        "discoverAllServicesAndCharacteristicsForDevice",
      ).mockResolvedValueOnce(mockDevice);
      vi.spyOn(bleManager, "monitorCharacteristicForDevice").mockImplementation(
        vi.fn(),
      );
      vi.spyOn(
        bleManager,
        "writeCharacteristicWithoutResponseForDevice",
      ).mockImplementation(vi.fn());
      vi.spyOn(bleManager, "onDeviceDisconnected").mockImplementation(vi.fn());
      vi.spyOn(bleManager, "isDeviceConnected").mockImplementation(vi.fn());
      vi.spyOn(bleManager, "onStateChange").mockImplementation(
        (listener: (state: State) => void) => {
          listener(State.PoweredOn);
          return {
            remove: vi.fn(),
          };
        },
      );

      vi.spyOn(bleManager, "onDeviceDisconnected").mockImplementation(
        onDeviceDisconnected,
      );
      vi.spyOn(bleManager, "isDeviceConnected").mockImplementation(vi.fn());

      const deviceConnectionStateMachineFactory = (
        _args: DeviceConnectionStateMachineParams<RNBleApduSenderDependencies>,
      ) => {
        return new DeviceConnectionStateMachine({
          deviceId: "deviceId",
          deviceApduSender: _args.deviceApduSender,
          timeoutDuration: 1000,
          onTerminated: _args.onTerminated,
        });
      };

      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: vi.fn().mockResolvedValue(undefined),
        closeConnection: fakeCloseConnection,
      });

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        deviceConnectionStateMachineFactory,
        deviceApduSenderFactory,
      );

      const fakeOnDisconnect = vi.fn();

      // when
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

      // then
      expect(res).toEqual(Right(undefined));
      expect(fakeOnDisconnect).toHaveBeenCalled();
      expect(fakeCloseConnection).toHaveBeenCalled();
    });

    it("should handle error while disconnecting", async () => {
      let scanInterval: NodeJS.Timeout | null = null;
      const bleManager = new BleManager();
      const mockDevice = {
        id: "deviceId",
        readRSSI: vi.fn().mockResolvedValueOnce({
          discoverAllServicesAndCharacteristics: vi.fn().mockResolvedValueOnce({
            services: vi.fn().mockResolvedValueOnce({}),
            serviceUUIDs: ["ledgerId"],
            rssi: 64,
            id: "knownDeviceId",
            localName: "knownDeviceName",
          }),
        }),
        services: vi.fn().mockResolvedValueOnce([
          {
            uuid: "ledgerId",
          },
        ]),
      } as unknown as Device;

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

      const onDeviceDisconnected = vi
        .fn()
        .mockImplementation((_id, callback) => {
          callback(new Error("yolo"), null);
          return { remove: vi.fn() };
        });

      const fakeCloseConnection = vi.fn();

      vi.spyOn(bleManager, "connectedDevices").mockImplementation(
        fakeConnectedDevices,
      );
      vi.spyOn(bleManager, "startDeviceScan").mockImplementation(startScan);
      vi.spyOn(bleManager, "stopDeviceScan").mockImplementation(stopScan);
      vi.spyOn(bleManager, "connectToDevice").mockResolvedValueOnce(mockDevice);
      vi.spyOn(
        bleManager,
        "discoverAllServicesAndCharacteristicsForDevice",
      ).mockResolvedValueOnce(mockDevice);
      vi.spyOn(bleManager, "monitorCharacteristicForDevice").mockImplementation(
        vi.fn(),
      );
      vi.spyOn(
        bleManager,
        "writeCharacteristicWithoutResponseForDevice",
      ).mockImplementation(vi.fn());
      vi.spyOn(bleManager, "onDeviceDisconnected").mockImplementation(vi.fn());
      vi.spyOn(bleManager, "isDeviceConnected").mockImplementation(vi.fn());
      vi.spyOn(bleManager, "onStateChange").mockImplementation(
        (listener: (state: State) => void) => {
          listener(State.PoweredOn);
          return {
            remove: vi.fn(),
          };
        },
      );

      vi.spyOn(bleManager, "onDeviceDisconnected").mockImplementation(
        onDeviceDisconnected,
      );
      vi.spyOn(bleManager, "isDeviceConnected").mockImplementation(vi.fn());

      const deviceConnectionStateMachineFactory = (
        _args: DeviceConnectionStateMachineParams<RNBleApduSenderDependencies>,
      ) => {
        return new DeviceConnectionStateMachine({
          deviceId: "deviceId",
          deviceApduSender: _args.deviceApduSender,
          timeoutDuration: 1000,
          onTerminated: _args.onTerminated,
        });
      };

      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: vi.fn().mockResolvedValue(undefined),
        closeConnection: fakeCloseConnection,
      });

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        bleManager,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        deviceConnectionStateMachineFactory,
        deviceApduSenderFactory,
      );

      const fakeOnDisconnect = vi.fn();

      // when
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

      // then
      expect(res).toEqual(Right(undefined));
      expect(fakeOnDisconnect).toHaveBeenCalled();
    });
  });
});
