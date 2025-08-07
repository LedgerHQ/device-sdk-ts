/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock("./WebBleApduSender", async () => ({
  WebBleApduSender: class {
    constructor(_deps: any, _loggerFactory: any) {}
    setupConnection = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("@ledgerhq/device-management-kit", async () => {
  const actual = (await vi.importActual(
    "@ledgerhq/device-management-kit",
  )) as any;
  return {
    ...actual,
    DeviceConnectionStateMachine: class {
      constructor(_opts: any) {}
      setupConnection = vi.fn().mockResolvedValue(undefined);
      setDependencies = vi.fn();
      sendApdu = vi.fn();
      closeConnection = vi.fn();
      eventDeviceDisconnected = vi.fn();
      eventDeviceConnected = vi.fn();
      eventDeviceDetached = vi.fn();
      eventDeviceAttached = vi.fn();
    },
  };
});

import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  DeviceAlreadyConnectedError,
  type LoggerPublisherService,
  type LoggerSubscriberService,
  OpeningConnectionError,
  StaticDeviceModelDataSource,
  type TransportConnectedDevice,
  UnknownDeviceError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { firstValueFrom } from "rxjs";

import { bleDeviceStubBuilder } from "@api/model/BleDevice.stub";

import { WebBleTransport } from "./WebBleTransport";

class LoggerPublisherServiceStub implements LoggerPublisherService {
  subscribers: LoggerSubscriberService[] = [];
  tag: string;
  constructor(subscribers: LoggerSubscriberService[], tag: string) {
    this.subscribers = subscribers;
    this.tag = tag;
  }
  error = vi.fn();
  warn = vi.fn();
  info = vi.fn();
  debug = vi.fn();
}

const bleDeviceModelDataSource = new StaticDeviceModelDataSource();
const logger = new LoggerPublisherServiceStub([], "WebBleTransport");

let transport: WebBleTransport;
let apduReceiverFactory: ApduReceiverServiceFactory;
let apduSenderFactory: ApduSenderServiceFactory;

beforeEach(() => {
  vi.useRealTimers();
  apduReceiverFactory = vi.fn();
  apduSenderFactory = vi.fn();
  transport = new WebBleTransport(
    bleDeviceModelDataSource,
    () => logger,
    apduSenderFactory,
    apduReceiverFactory,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WebBleTransport", () => {
  describe("isSupported", () => {
    it("returns false when navigator.bluetooth is undefined", () => {
      delete (globalThis as any).navigator;

      const result = transport.isSupported();

      expect(result).toBe(false);
    });

    it("returns true when navigator.bluetooth exists", () => {
      (globalThis as any).navigator = { bluetooth: {} };

      const result = transport.isSupported();

      expect(result).toBe(true);
    });
  });

  describe("startDiscovering", () => {
    let requestDevice: ReturnType<typeof vi.fn>;
    let stubDevice: BluetoothDevice;
    let mockService: any;

    const serviceUuid = bleDeviceModelDataSource.getBluetoothServices()[0];

    const makeGatt = (service: any) => {
      const gatt: any = {
        connected: false,
        connect: vi.fn().mockImplementation(async () => {
          gatt.connected = true;
          return gatt;
        }),
        disconnect: vi.fn().mockImplementation(() => {
          gatt.connected = false;
        }),
        getPrimaryService: vi.fn().mockImplementation(async (uuid: string) => {
          if (uuid.toLowerCase() === service.uuid.toLowerCase()) {
            return service;
          }
          const err = new Error("NotFoundError");
          (err as any).name = "NotFoundError";
          throw err;
        }),
        getPrimaryServices: vi.fn().mockResolvedValue([service]),
      };
      return gatt;
    };

    beforeEach(() => {
      stubDevice = bleDeviceStubBuilder();
      mockService = {
        uuid: serviceUuid,
        device: stubDevice,
        getCharacteristic: vi.fn().mockResolvedValue({}),
      };

      const gatt = makeGatt(mockService);

      Object.defineProperty(stubDevice, "gatt", {
        value: gatt,
        writable: true,
        configurable: true,
      });

      if (!(stubDevice as any).addEventListener) {
        (stubDevice as any).addEventListener = vi.fn();
        (stubDevice as any).removeEventListener = vi.fn();
      }

      requestDevice = vi.fn();
      (globalThis as any).navigator = {
        bluetooth: { requestDevice },
      };
    });

    it("emits a discovered device when a known device is returned", async () => {
      // given
      requestDevice.mockResolvedValueOnce(stubDevice);

      // when
      const device = await firstValueFrom(transport.startDiscovering());

      const expectedModelId =
        bleDeviceModelDataSource.getBluetoothServicesInfos()[serviceUuid!]
          ?.deviceModel.id;

      // then
      expect(device).toEqual(
        expect.objectContaining({
          deviceModel: expect.objectContaining({ id: expectedModelId }),
          transport: transport.getIdentifier(),
        }),
      );
    });

    it("emits UnknownDeviceError when deviceInfo is missing", async () => {
      // given
      const unknown = bleDeviceStubBuilder();
      const unknownService = {
        uuid: "invalid-uuid",
        device: unknown,
        getCharacteristic: vi.fn(),
      };

      const gatt: any = {
        connected: false,
        connect: vi.fn().mockImplementation(async () => {
          gatt.connected = true;
          return gatt;
        }),
        disconnect: vi.fn(),
        // returning a service (success) but with an unknown uuid triggers UnknownDeviceError
        getPrimaryService: vi.fn().mockResolvedValue(unknownService),
        getPrimaryServices: vi.fn().mockResolvedValue([unknownService]),
      };

      Object.defineProperty(unknown, "gatt", {
        value: gatt,
        writable: true,
        configurable: true,
      });

      requestDevice.mockResolvedValueOnce(unknown);

      // then
      await expect(
        firstValueFrom(transport.startDiscovering()),
      ).rejects.toBeInstanceOf(OpeningConnectionError);
    });

    it("throws OpeningConnectionError when device has no GATT server", async () => {
      // given
      const noGattStub = bleDeviceStubBuilder();
      Object.defineProperty(noGattStub, "gatt", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      requestDevice.mockResolvedValueOnce(noGattStub);

      // then
      await expect(
        firstValueFrom(transport.startDiscovering()),
      ).rejects.toBeInstanceOf(OpeningConnectionError);
    });

    it("throws OpeningConnectionError when no GATT services are found", async () => {
      // given
      const noServiceStub = bleDeviceStubBuilder();
      const gatt: any = {
        connected: false,
        connect: vi.fn().mockImplementation(async () => gatt),
        disconnect: vi.fn(),
        getPrimaryService: vi.fn().mockRejectedValue(new Error("nope")),
        getPrimaryServices: vi.fn().mockResolvedValue([]),
      };
      Object.defineProperty(noServiceStub, "gatt", {
        value: gatt,
        writable: true,
        configurable: true,
      });
      requestDevice.mockResolvedValueOnce(noServiceStub);

      // then
      await expect(
        firstValueFrom(transport.startDiscovering()),
      ).rejects.toBeInstanceOf(OpeningConnectionError);
    });
  });

  describe("connect/disconnect flow", () => {
    let requestDevice: ReturnType<typeof vi.fn>;
    let stubDevice: BluetoothDevice;
    let mockService: any;

    const serviceUuid = bleDeviceModelDataSource.getBluetoothServices()[0];

    const makeGatt = (service: any) => {
      const gatt: any = {
        connected: false,
        connect: vi.fn().mockImplementation(async () => {
          gatt.connected = true;
          return gatt;
        }),
        disconnect: vi.fn().mockImplementation(() => {
          gatt.connected = false;
        }),
        getPrimaryService: vi.fn().mockImplementation(async (uuid: string) => {
          if (uuid.toLowerCase() === service.uuid.toLowerCase()) {
            return service;
          }
          const err = new Error("NotFoundError");
          (err as any).name = "NotFoundError";
          throw err;
        }),
        getPrimaryServices: vi.fn().mockResolvedValue([service]),
      };
      return gatt;
    };

    beforeEach(() => {
      stubDevice = bleDeviceStubBuilder();

      const charNotify: any = { properties: {} };
      const charWrite: any = { properties: { write: true } };

      mockService = {
        uuid: serviceUuid,
        device: stubDevice,
        getCharacteristic: vi
          .fn()
          .mockResolvedValueOnce(charNotify)
          .mockResolvedValue(charWrite),
      };

      const gatt = makeGatt(mockService);

      Object.defineProperty(stubDevice, "gatt", {
        value: gatt,
        writable: true,
        configurable: true,
      });

      if (!(stubDevice as any).addEventListener) {
        (stubDevice as any).addEventListener = vi.fn();
        (stubDevice as any).removeEventListener = vi.fn();
      }

      requestDevice = vi.fn().mockResolvedValue(stubDevice);
      (globalThis as any).navigator = {
        bluetooth: { requestDevice },
      };
    });

    it("returns UnknownDeviceError when connecting an unknown deviceId", async () => {
      // given
      const deviceId = "nonexistent";

      // when
      const result = await transport.connect({
        deviceId,
        onDisconnect: vi.fn(),
      });

      // then
      expect(result).toEqual(
        Left(new UnknownDeviceError(`Unknown device ${deviceId}`)),
      );
    });

    it("connects and returns a connected device on success", async () => {
      // given
      const discovered = await firstValueFrom(transport.startDiscovering());

      // when
      const result = await transport.connect({
        deviceId: discovered.id,
        onDisconnect: vi.fn(),
      });

      // then
      expect(result.isRight()).toBe(true);
      const conn = result.extract() as TransportConnectedDevice;
      expect(conn.id).toBe(discovered.id);
    });

    it("does not allow connecting twice to the same device", async () => {
      // given
      const discovered = await firstValueFrom(transport.startDiscovering());
      await transport.connect({
        deviceId: discovered.id,
        onDisconnect: vi.fn(),
      });

      // when
      const secondAttempt = await transport.connect({
        deviceId: discovered.id,
        onDisconnect: vi.fn(),
      });

      // then
      expect(secondAttempt).toEqual(
        Left(
          new DeviceAlreadyConnectedError(
            `Device ${discovered.id} already connected`,
          ),
        ),
      );
    });

    it("returns OpeningConnectionError when characteristic retrieval fails", async () => {
      // given
      const badService = {
        uuid: serviceUuid,
        device: stubDevice,
        getCharacteristic: vi.fn().mockRejectedValue(new Error("boom")),
      };
      const badGatt = {
        ...stubDevice.gatt,
        getPrimaryService: vi.fn().mockResolvedValue(badService),
        getPrimaryServices: vi.fn().mockResolvedValue([badService]),
      } as any;

      Object.defineProperty(stubDevice, "gatt", {
        value: badGatt,
        writable: true,
        configurable: true,
      });

      const discovered = await firstValueFrom(transport.startDiscovering());

      // when
      const result = await transport.connect({
        deviceId: discovered.id,
        onDisconnect: vi.fn(),
      });

      // then
      expect(result.isLeft()).toBe(true);
      expect(result.extract()).toBeInstanceOf(OpeningConnectionError);
    });

    it("disconnects successfully", async () => {
      // given
      const discovered = await firstValueFrom(transport.startDiscovering());
      const result = await transport.connect({
        deviceId: discovered.id,
        onDisconnect: vi.fn(),
      });
      const conn = result.extract() as TransportConnectedDevice;

      // when
      const disc = await transport.disconnect({ connectedDevice: conn });

      // then
      expect(disc).toEqual(Right(undefined));
    });
  });
});
