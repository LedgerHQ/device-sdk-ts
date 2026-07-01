import {
  type LoggerPublisherService,
  OpeningConnectionError,
  type TransportConnectedDevice,
} from "@ledgerhq/device-management-kit";
import { type Device, MockClient } from "@ledgerhq/device-mockserver-client";
import { firstValueFrom, take, toArray } from "rxjs";

import {
  mockserverIdentifier,
  mockserverTransportFactory,
} from "./MockserverTransport";

vi.mock("@ledgerhq/device-mockserver-client", () => ({
  MockClient: vi.fn(),
}));

type TransportArgs = Parameters<
  ReturnType<typeof mockserverTransportFactory>
>[0];

const loggerServiceFactory = (): LoggerPublisherService =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as LoggerPublisherService;

const transportArgs = {
  config: { mockUrl: "http://localhost:8080" },
  loggerServiceFactory,
} as unknown as TransportArgs;

const aDevice = (overrides: Partial<Device> = {}): Device => ({
  id: "device-1",
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  ...overrides,
});

const mockListDevices = (
  impl: () => Promise<Device[]>,
): ReturnType<typeof vi.fn> => {
  const listDevices = vi.fn(impl);
  vi.mocked(MockClient).mockImplementation(
    () => ({ listDevices }) as unknown as MockClient,
  );
  return listDevices;
};

const mockClientImpl = (overrides: Partial<Record<string, unknown>> = {}) => {
  const client = {
    listDevices: vi.fn(() => Promise.resolve([])),
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendApdu: vi.fn(),
    ...overrides,
  };
  vi.mocked(MockClient).mockImplementation(
    () => client as unknown as MockClient,
  );
  return client;
};

describe("mockserverTransportFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDevices(() => Promise.resolve([]));
  });

  it("builds a supported transport with the mockserver identifier", () => {
    const transport = mockserverTransportFactory("http://localhost:8080")(
      transportArgs,
    );

    expect(transport.getIdentifier()).toBe(mockserverIdentifier);
    expect(transport.isSupported()).toBe(true);
  });

  it("accepts an injected session token without throwing", () => {
    expect(() =>
      mockserverTransportFactory(
        "http://localhost:8080",
        "tok-123",
      )(transportArgs),
    ).not.toThrow();
  });

  describe("listenToAvailableDevices", () => {
    it("emits the mock server devices mapped as discovered devices", async () => {
      mockListDevices(() =>
        Promise.resolve([aDevice(), aDevice({ id: "device-2", name: "Stax" })]),
      );
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );

      const devices = await firstValueFrom(
        transport.listenToAvailableDevices(),
      );

      expect(devices).toEqual([
        expect.objectContaining({
          id: "device-1",
          transport: mockserverIdentifier,
        }),
        expect.objectContaining({
          id: "device-2",
          transport: mockserverIdentifier,
        }),
      ]);
    });

    it("keeps polling so newly added devices appear", async () => {
      const listDevices = mockListDevices(() => Promise.resolve([]));
      listDevices.mockResolvedValueOnce([]).mockResolvedValueOnce([aDevice()]);
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );

      const emissions = await firstValueFrom(
        transport.listenToAvailableDevices().pipe(take(2), toArray()),
      );

      expect(emissions[0]).toEqual([]);
      expect(emissions[1]).toEqual([
        expect.objectContaining({ id: "device-1" }),
      ]);
    });

    it("emits an empty list when the mock server is unreachable", async () => {
      mockListDevices(() => Promise.reject(new Error("offline")));
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );

      const devices = await firstValueFrom(
        transport.listenToAvailableDevices(),
      );

      expect(devices).toEqual([]);
    });
  });

  describe("startDiscovering", () => {
    it("emits each device returned by the mock server", async () => {
      mockClientImpl({
        listDevices: vi.fn(() =>
          Promise.resolve([
            aDevice(),
            aDevice({ id: "device-2", name: "Stax" }),
          ]),
        ),
      });
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );

      const devices = await firstValueFrom(
        transport.startDiscovering().pipe(toArray()),
      );

      expect(devices).toEqual([
        expect.objectContaining({ id: "device-1" }),
        expect.objectContaining({ id: "device-2" }),
      ]);
    });
  });

  describe("stopDiscovering", () => {
    it("does nothing and does not throw", () => {
      mockClientImpl();
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );

      expect(() => transport.stopDiscovering()).not.toThrow();
    });
  });

  describe("connect", () => {
    it("returns a connected device on success", async () => {
      mockClientImpl({
        connect: vi.fn(() =>
          Promise.resolve({
            device: aDevice({ masks: [0x12345678] }),
            connected: true,
          }),
        ),
      });
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );
      const onDisconnect = vi.fn();

      const result = await transport.connect({
        deviceId: "device-1",
        onDisconnect,
      });

      expect(result.isRight()).toBe(true);
      const connected = result.unsafeCoerce();
      expect(connected.id).toBe("device-1");
      expect(connected.transport).toBe(mockserverIdentifier);
      expect(connected.deviceModel.masks).toEqual([0x12345678]);
    });

    it("falls back to the default masks when the device has none", async () => {
      mockClientImpl({
        connect: vi.fn(() =>
          Promise.resolve({ device: aDevice(), connected: true }),
        ),
      });
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );

      const result = await transport.connect({
        deviceId: "device-1",
        onDisconnect: vi.fn(),
      });

      expect(result.unsafeCoerce().deviceModel.masks).toEqual([0x31100000]);
      // A known model (nanoX) reports its real block size, not the legacy default.
      expect(
        result.unsafeCoerce().deviceModel.getBlockSize({
          firmwareVersion: "1.0.0",
        }),
      ).toBe(4 * 1024);
    });

    it("returns an OpeningConnectionError when the client throws", async () => {
      mockClientImpl({
        connect: vi.fn(() => Promise.reject(new Error("nope"))),
      });
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );

      const result = await transport.connect({
        deviceId: "device-1",
        onDisconnect: vi.fn(),
      });

      expect(result.isLeft()).toBe(true);
      expect(result.swap().unsafeCoerce()).toBeInstanceOf(
        OpeningConnectionError,
      );
    });
  });

  describe("disconnect", () => {
    const connectedDevice = {
      id: "device-1",
    } as TransportConnectedDevice;

    it("returns Right(undefined) when the client disconnects successfully", async () => {
      const disconnect = vi.fn(() => Promise.resolve(true));
      mockClientImpl({ disconnect });
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );

      const result = await transport.disconnect({ connectedDevice });

      expect(disconnect).toHaveBeenCalledWith("device-1");
      expect(result.isRight()).toBe(true);
    });

    it("returns a DisconnectError when the client reports failure", async () => {
      mockClientImpl({ disconnect: vi.fn(() => Promise.resolve(false)) });
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );

      const result = await transport.disconnect({ connectedDevice });

      expect(result.isLeft()).toBe(true);
    });

    it("returns a DisconnectError when the client throws", async () => {
      mockClientImpl({
        disconnect: vi.fn(() => Promise.reject(new Error("boom"))),
      });
      const transport = mockserverTransportFactory("http://localhost:8080")(
        transportArgs,
      );

      const result = await transport.disconnect({ connectedDevice });

      expect(result.isLeft()).toBe(true);
    });
  });

  describe("sendApdu", () => {
    const buildConnectedTransport = (sendApdu: ReturnType<typeof vi.fn>) => {
      mockClientImpl({
        connect: vi.fn(() =>
          Promise.resolve({ device: aDevice(), connected: true }),
        ),
        sendApdu,
      });
      return mockserverTransportFactory("http://localhost:8080")(transportArgs);
    };

    it("splits the response into data and status code", async () => {
      const sendApdu = vi.fn(() => Promise.resolve({ response: "aabb9000" }));
      const transport = buildConnectedTransport(sendApdu);
      const onDisconnect = vi.fn();
      const connected = (
        await transport.connect({ deviceId: "device-1", onDisconnect })
      ).unsafeCoerce();

      const result = await connected.sendApdu(
        Uint8Array.from([0xe0, 0x01, 0x00, 0x00]),
      );

      expect(result.isRight()).toBe(true);
      const apduResponse = result.unsafeCoerce();
      expect(Array.from(apduResponse.data)).toEqual([0xaa, 0xbb]);
      expect(Array.from(apduResponse.statusCode)).toEqual([0x90, 0x00]);
      expect(onDisconnect).not.toHaveBeenCalled();
    });

    it("calls onDisconnect and returns a NoAccessibleDeviceError on failure", async () => {
      const sendApdu = vi.fn(() => Promise.reject(new Error("device lost")));
      const transport = buildConnectedTransport(sendApdu);
      const onDisconnect = vi.fn();
      const connected = (
        await transport.connect({ deviceId: "device-1", onDisconnect })
      ).unsafeCoerce();

      const result = await connected.sendApdu(
        Uint8Array.from([0xe0, 0x01, 0x00, 0x00]),
      );

      expect(result.isLeft()).toBe(true);
      expect(onDisconnect).toHaveBeenCalledWith("device-1");
    });
  });

  describe("mockserverTransportFactory", () => {
    it("uses the config mock url when no explicit url is provided", () => {
      const client = mockClientImpl();
      expect(client).toBeDefined();

      mockserverTransportFactory()(transportArgs);

      expect(MockClient).toHaveBeenCalledWith(
        "http://localhost:8080",
        expect.anything(),
      );
    });

    it("prefers an explicit url over the config mock url", () => {
      mockClientImpl();

      mockserverTransportFactory("https://explicit:9090")(transportArgs);

      expect(MockClient).toHaveBeenCalledWith(
        "https://explicit:9090",
        expect.anything(),
      );
    });
  });
});
