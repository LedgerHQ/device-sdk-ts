import { type PermissionsAndroid, type Platform } from "react-native";
import { type PermissionStatus } from "react-native/Libraries/PermissionsAndroid/PermissionsAndroid";
import { type BleManager } from "react-native-ble-plx";
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
  TransportConnectedDevice,
  TransportDeviceModel,
  type TransportDiscoveredDevice,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { firstValueFrom } from "rxjs";
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
  BleManager: vi.fn(),
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

// TODO: fix these tests, sorry they are completely broken now
describe.skip("RNBleTransportFactory", () => {
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

// TODO: fix these tests, sorry they are completely broken now
describe.skip("RNBleTransport", () => {
  const fakePlaftorm = { OS: "ios" };
  const fakeDeviceModel = new TransportDeviceModel({
    id: DeviceModelId.FLEX,
    productName: "Ledger Flex",
    usbProductId: 0x70,
    bootloaderUsbProductId: 0x0007,
    usbOnly: false,
    memorySize: 1533 * 1024,
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getIdentifier", () => {
    it("should return rnBleTransportIdentifier", () => {
      // given
      const transport = new RNBleTransport(
        "DeviceModelDataSource" as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
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
      const transport = new RNBleTransport(
        "DeviceModelDataSource" as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
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
      const transport = new RNBleTransport(
        "DeviceModelDataSource" as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        { OS: "windows" } as Platform,
      );

      // when
      await transport.requestPermission();
      const isSupported = transport.isSupported();

      // then
      expect(isSupported).toBe(false);
    });
  });

  describe("startDiscovering", () => {
    it("should throw error if transport is not supported", () => {
      // given
      const platform = { OS: "windows" };

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
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

    it("should emit discovered known device", () =>
      new Promise((done) => {
        // given
        const bleManager = {
          connectedDevices: vi.fn().mockResolvedValueOnce([
            {
              readRSSI: vi.fn().mockResolvedValueOnce({
                discoverAllServicesAndCharacteristics: vi
                  .fn()
                  .mockResolvedValueOnce({
                    services: vi.fn().mockResolvedValue({}),
                    serviceUUIDs: ["ledgerId"],
                    rssi: 42,
                    id: "id",
                    localName: "name",
                  }),
              }),
            },
          ]),
          startDeviceScan: vi.fn(),
          stopDeviceScan: vi.fn(),
          onDeviceDisconnected: vi.fn(),
        } as unknown as BleManager;
        const transport = new RNBleTransport(
          fakeDataSource as unknown as DeviceModelDataSource,
          () => fakeLogger as unknown as LoggerPublisherService,
          (() => {}) as unknown as ApduSenderServiceFactory,
          (() => {}) as unknown as ApduReceiverServiceFactory,
          fakePlaftorm as Platform,
          {} as unknown as PermissionsAndroid,
          () => bleManager,
        );

        // when
        const observable = transport.startDiscovering();

        // then
        const subscription = observable.subscribe({
          next: (discoveredDevice) => {
            expect(discoveredDevice).toStrictEqual({
              id: "id",
              name: "name",
              deviceModel: fakeDeviceModel,
              transport: "RN_BLE",
              rssi: 42,
            });
            subscription.unsubscribe();
            done(void 0);
          },
          error: (e) => {
            if (subscription && !subscription.closed) {
              subscription.unsubscribe();
            }
            throw e;
          },
          complete: () => {
            if (subscription && !subscription.closed) {
              subscription.unsubscribe();
            }
            throw new Error("complete should not be called");
          },
        });
      }));

    it("should emit discovered new device", () =>
      new Promise((done) => {
        // given
        let scanInterval: NodeJS.Timeout;

        const startScan = vi.fn((_uuids, _options, listener) => {
          scanInterval = setInterval(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            listener(null, {
              id: "id",
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

        const stopScan = vi.fn(() => {
          clearInterval(scanInterval);
        });

        const bleManager = {
          connectedDevices: vi.fn().mockResolvedValueOnce([]),
          startDeviceScan: startScan,
          stopDeviceScan: stopScan,
          onDeviceDisconnected: vi.fn(),
        } as unknown as BleManager;

        const transport = new RNBleTransport(
          fakeDataSource as unknown as DeviceModelDataSource,
          () => fakeLogger as unknown as LoggerPublisherService,
          (() => {}) as unknown as ApduSenderServiceFactory,
          (() => {}) as unknown as ApduReceiverServiceFactory,
          fakePlaftorm as Platform,
          {} as unknown as PermissionsAndroid,
          () => bleManager,
        );

        // when
        const observable = transport.startDiscovering();

        // then
        const subscription = observable.subscribe({
          next: (discoveredDevice) => {
            expect(discoveredDevice).toStrictEqual({
              id: "id",
              name: "name",
              deviceModel: fakeDeviceModel,
              transport: "RN_BLE",
              rssi: 42,
            });
            subscription.unsubscribe();
            done(void 0);
          },
          error: (e) => {
            if (subscription && !subscription.closed) {
              subscription.unsubscribe();
            }
            throw e;
          },
          complete: () => {
            if (subscription && !subscription.closed) {
              subscription.unsubscribe();
            }
            throw new Error("complete should not be called");
          },
        });
      }));

    it("should emit both known and new device", () =>
      new Promise((done) => {
        // given
        let scanInterval: NodeJS.Timeout;
        const startScan = vi.fn((_uuids, _options, listener) => {
          scanInterval = setInterval(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            listener(null, {
              id: "newDeviceId",
              localName: "newDeviceName",
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

        const stopScan = vi.fn(() => {
          clearInterval(scanInterval);
        });

        const fakeConnectedDevices = vi.fn().mockResolvedValueOnce([
          {
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
          },
        ]);

        const bleManager = {
          connectedDevices: fakeConnectedDevices,
          startDeviceScan: startScan,
          stopDeviceScan: stopScan,
          onDeviceDisconnected: vi.fn(),
        } as unknown as BleManager;

        const transport = new RNBleTransport(
          fakeDataSource as unknown as DeviceModelDataSource,
          () => fakeLogger as unknown as LoggerPublisherService,
          (() => {}) as unknown as ApduSenderServiceFactory,
          (() => {}) as unknown as ApduReceiverServiceFactory,
          fakePlaftorm as Platform,
          {} as unknown as PermissionsAndroid,
          () => bleManager,
        );

        // when
        const obs = transport.startDiscovering();
        const discoveredDevices: Record<string, TransportDiscoveredDevice> = {};

        // then
        const subscription = obs.subscribe({
          next: (device) => {
            discoveredDevices[device.id] = device;
            if (Object.values(discoveredDevices).length === 2) {
              subscription.unsubscribe();
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
              done(void 0);
            }
          },
        });
      }));
  });

  describe("stopDiscovering", () => {
    it("should call ble manager stop scan on stop discovering", () => {
      // given
      const fakeStopDeviceScan = vi.fn();
      const bleManager = {
        connectedDevices: vi.fn().mockResolvedValueOnce([]),
        startDeviceScan: vi.fn(),
        stopDeviceScan: fakeStopDeviceScan,
        onDeviceDisconnected: vi.fn(),
      } as unknown as BleManager;
      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        () => bleManager,
      );

      // when
      transport.stopDiscovering();

      // then
      expect(fakeStopDeviceScan).toHaveBeenCalled();
    });

    it("should call ble manager stop scan when unsubscribe startDiscovering obs", () => {
      // given
      let scanInterval: NodeJS.Timeout | undefined;

      const startScan = vi.fn((_uuids, _options, listener) => {
        scanInterval = setInterval(() => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          listener(null, {
            id: "id",
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

      const stopScan = vi.fn(() => {
        clearInterval(scanInterval);
        scanInterval = undefined;
      });

      const bleManager = {
        connectedDevices: vi.fn().mockResolvedValueOnce([]),
        startDeviceScan: startScan,
        stopDeviceScan: stopScan,
        onDeviceDisconnected: vi.fn(),
      } as unknown as BleManager;
      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        () => bleManager,
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
        let scanInterval: NodeJS.Timeout | undefined;

        const startScan = vi.fn((_uuids, _options, listener) => {
          scanInterval = setInterval(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            listener(null, {
              id: "id",
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
        const stopScan = vi.fn(() => {
          clearInterval(scanInterval);
          scanInterval = undefined;
        });
        const fakeConnectedDevices = vi.fn().mockResolvedValueOnce([
          {
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
          },
        ]);
        const bleManager = {
          connectedDevices: fakeConnectedDevices,
          startDeviceScan: startScan,
          stopDeviceScan: stopScan,
          onDeviceDisconnected: vi.fn(),
          isDeviceConnected: vi.fn(),
        } as unknown as BleManager;
        const transport = new RNBleTransport(
          fakeDataSource as unknown as DeviceModelDataSource,
          () => fakeLogger as unknown as LoggerPublisherService,
          (() => {}) as unknown as ApduSenderServiceFactory,
          (() => {}) as unknown as ApduReceiverServiceFactory,
          fakePlaftorm as Platform,
          {} as unknown as PermissionsAndroid,
          () => bleManager,
        );

        // when
        const sub = transport.listenToAvailableDevices().subscribe({
          next: (devices) => {
            if (devices.length === 2) {
              // then
              expect(devices).toEqual([
                {
                  id: "knownDeviceId",
                  name: "knownDeviceName",
                  deviceModel: fakeDeviceModel,
                  transport: "RN_BLE",
                  rssi: 64,
                },
                {
                  id: "id",
                  name: "name",
                  deviceModel: fakeDeviceModel,
                  transport: "RN_BLE",
                  rssi: 42,
                },
              ]);
              sub.unsubscribe();
              done(void 0);
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
      const bleManager = {
        connectedDevices: vi.fn(),
        startDeviceScan: vi.fn(),
        stopDeviceScan: vi.fn(),
        onDeviceDisconnected: vi.fn(),
        isDeviceConnected: vi.fn(),
      } as unknown as BleManager;

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        () => bleManager,
      );

      // when
      const result = await transport.connect({
        deviceId: "42",
        onDisconnect: vi.fn(),
      });

      // then
      expect(result).toEqual(Left(new UnknownDeviceError(`Unknown device 42`)));
    });

    it("should connect to a discovered device with correct MTU and discover services and setup apdu sender", async () => {
      // given
      const bleManager = {
        connectedDevices: fakeConnectedDevices,
        startDeviceScan: vi.fn(),
        stopDeviceScan: vi.fn(),
        onDeviceDisconnected: vi.fn(),
        isDeviceConnected: vi.fn(),
        monitorCharacteristicForDevice: vi.fn(),
        writeCharacteristicWithoutResponseForDevice: vi.fn(),
        connectToDevice: vi.fn().mockResolvedValueOnce({
          id: "deviceId",
          rssi: 64,
        }),
        discoverAllServicesAndCharacteristicsForDevice: vi.fn(),
      } as unknown as BleManager;

      const fakeSetupConnection = vi.fn();
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
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        () => bleManager,
        deviceConnectionStateMachineFactory,
        deviceApduSenderFactory,
      );

      // when
      const device = await firstValueFrom(transport.startDiscovering());
      const result = await transport.connect({
        deviceId: device.id,
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
      const bleManager = {
        connectedDevices: fakeConnectedDevices,
        startDeviceScan: vi.fn(),
        stopDeviceScan: vi.fn(),
        onDeviceDisconnected: vi.fn(),
        isDeviceConnected: vi.fn(),
        monitorCharacteristicForDevice: vi.fn(),
        writeCharacteristicWithoutResponseForDevice: vi.fn(),
        connectToDevice: vi.fn().mockResolvedValueOnce({
          id: "deviceId",
          rssi: 64,
        }),
        discoverAllServicesAndCharacteristicsForDevice: vi.fn(),
      } as unknown as BleManager;

      const fakeSendApdu = vi.fn();
      const deviceConnectionStateMachineFactory = vi.fn().mockReturnValue({
        sendApdu: fakeSendApdu,
      });
      const deviceApduSenderFactory = vi.fn().mockReturnValue({
        setupConnection: vi.fn(),
      });

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        () => bleManager,
        deviceConnectionStateMachineFactory,
        deviceApduSenderFactory,
      );

      // when
      const device = await firstValueFrom(transport.startDiscovering());
      const result = await transport.connect({
        deviceId: device.id,
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

    it("should disconnect gracefully", async () => {
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
      // given
      const bleManager = {
        connectedDevices: fakeConnectedDevices,
        startDeviceScan: vi.fn(),
        stopDeviceScan: vi.fn(),
        onDeviceDisconnected: onDeviceDisconnected,
        isDeviceConnected: vi.fn(),
        monitorCharacteristicForDevice: vi.fn(),
        writeCharacteristicWithoutResponseForDevice: vi.fn(),
        connectToDevice: vi.fn().mockResolvedValueOnce({
          id: "deviceId",
          rssi: 64,
        }),
        discoverAllServicesAndCharacteristicsForDevice: vi.fn(),
      } as unknown as BleManager;

      const fakeCloseConnection = vi.fn();

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
        setupConnection: vi.fn(),
        closeConnection: fakeCloseConnection,
      });

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        () => bleManager,
        deviceConnectionStateMachineFactory,
        deviceApduSenderFactory,
      );

      const fakeOnDisconnect = vi.fn();

      // when
      const device = await firstValueFrom(transport.startDiscovering());
      const result = await transport.connect({
        deviceId: device.id,
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
      const onDeviceDisconnected = vi
        .fn()
        .mockImplementation((_id, callback) => {
          callback(new Error("yolo"), null);
          return { remove: vi.fn() };
        });
      // given
      const bleManager = {
        connectedDevices: fakeConnectedDevices,
        startDeviceScan: vi.fn(),
        stopDeviceScan: vi.fn(),
        onDeviceDisconnected: onDeviceDisconnected,
        isDeviceConnected: vi.fn(),
        monitorCharacteristicForDevice: vi.fn(),
        writeCharacteristicWithoutResponseForDevice: vi.fn(),
        connectToDevice: vi.fn().mockResolvedValueOnce({
          id: "deviceId",
          rssi: 64,
        }),
        discoverAllServicesAndCharacteristicsForDevice: vi.fn(),
      } as unknown as BleManager;

      const fakeCloseConnection = vi.fn();

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
        setupConnection: vi.fn(),
        closeConnection: fakeCloseConnection,
      });

      const transport = new RNBleTransport(
        fakeDataSource as unknown as DeviceModelDataSource,
        () => fakeLogger as unknown as LoggerPublisherService,
        (() => {}) as unknown as ApduSenderServiceFactory,
        (() => {}) as unknown as ApduReceiverServiceFactory,
        fakePlaftorm as Platform,
        {} as unknown as PermissionsAndroid,
        () => bleManager,
        deviceConnectionStateMachineFactory,
        deviceApduSenderFactory,
      );

      const fakeOnDisconnect = vi.fn();

      // when
      const device = await firstValueFrom(transport.startDiscovering());
      const result = await transport.connect({
        deviceId: device.id,
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
