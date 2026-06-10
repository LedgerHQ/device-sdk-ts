import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
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
});
