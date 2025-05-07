/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("./WebBleApduSender", async () => ({
  WebBleApduSender: class {
    constructor(_deps: any, _loggerFactory: any) {}
    setDependencies = vi.fn().mockResolvedValue(undefined);
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
      sendApdu = vi.fn();
      closeConnection = vi.fn();
      eventDeviceDetached = vi.fn();
      eventDeviceAttached = vi.fn();
    },
  };
});

import {
  type ApduReceiverServiceFactory,
  type ApduSenderServiceFactory,
  type LoggerPublisherService,
  type LoggerSubscriberService,
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
  vi.useFakeTimers();
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
      // given
      delete (globalThis as any).navigator;

      // when
      const result = transport.isSupported();

      // then
      expect(result).toBe(false);
    });

    it("returns true when navigator.bluetooth exists", () => {
      // given
      (globalThis as any).navigator = { bluetooth: {} };

      // when
      const result = transport.isSupported();

      // then
      expect(result).toBe(true);
    });
  });

  describe("startDiscovering", () => {
    let requestDevice: ReturnType<typeof vi.fn>;
    let stubDevice: BluetoothDevice;
    let mockService: any;
    let mockServer: any;

    beforeEach(() => {
      const serviceUuid = bleDeviceModelDataSource.getBluetoothServices()[0];
      stubDevice = bleDeviceStubBuilder();
      mockService = {
        uuid: serviceUuid,
        getCharacteristic: vi.fn().mockResolvedValue({}),
      };
      mockServer = { getPrimaryServices: () => Promise.resolve([mockService]) };
      Object.defineProperty(stubDevice, "gatt", {
        value: { connect: () => Promise.resolve(mockServer) },
        writable: true,
        configurable: true,
      });

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

      // then
      expect(device).toEqual(
        expect.objectContaining({
          deviceModel: expect.objectContaining({ id: "nanoX" }),
          transport: transport.getIdentifier(),
        }),
      );
    });

    it("emits UnknownDeviceError when deviceInfo is missing", async () => {
      // given
      const unknownStub = bleDeviceStubBuilder();
      Object.defineProperty(unknownStub, "gatt", {
        value: {
          connect: () =>
            Promise.resolve({
              getPrimaryServices: () => Promise.resolve([{ uuid: "invalid" }]),
            } as any),
        },
        writable: true,
        configurable: true,
      });
      requestDevice.mockResolvedValueOnce(unknownStub);

      // when / then
      await expect(
        firstValueFrom(transport.startDiscovering()),
      ).rejects.toBeInstanceOf(UnknownDeviceError);
    });
  });

  describe("connect/disconnect flow", () => {
    let requestDevice: ReturnType<typeof vi.fn>;
    let stubDevice: BluetoothDevice;
    let mockService: any;
    let mockServer: any;

    beforeEach(() => {
      const serviceUuid = bleDeviceModelDataSource.getBluetoothServices()[0];
      stubDevice = bleDeviceStubBuilder();
      mockService = {
        uuid: serviceUuid,
        getCharacteristic: vi.fn().mockResolvedValue({}),
      };
      mockServer = { getPrimaryServices: () => Promise.resolve([mockService]) };
      Object.defineProperty(stubDevice, "gatt", {
        value: { connect: () => Promise.resolve(mockServer) },
        writable: true,
        configurable: true,
      });

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
