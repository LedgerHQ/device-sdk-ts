import {
  DeviceModelId,
  type DmkConfig,
  type LoggerPublisherService,
  type TransportArgs,
  type TransportConnectedDevice,
} from "@ledgerhq/device-management-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SpeculosTransport,
  speculosTransportFactory,
} from "@api/SpeculosTransport";
import { HttpSpeculosDatasource } from "@internal/datasource/HttpSpeculosDatasource";

const GET_APP_AND_VERSION_RESPONSE =
  "0108457468657265756d0a312e32332e302d64657601009000";

const postApdu = vi.fn();
const isServerAvailable = vi.fn();

vi.mock("@internal/datasource/HttpSpeculosDatasource", () => ({
  HttpSpeculosDatasource: vi.fn(() => ({
    postApdu,
    isServerAvailable,
    openEventStream: vi.fn(),
  })),
}));

const loggerFactory = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as LoggerPublisherService;

describe("SpeculosTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    postApdu.mockResolvedValue(GET_APP_AND_VERSION_RESPONSE);
    isServerAvailable.mockResolvedValue(true);
  });

  afterEach(() => {
    // Restore real timers so the fake ones cannot leak into another test file.
    vi.useRealTimers();
  });

  const connect = async () => {
    const transport = new SpeculosTransport(
      loggerFactory,
      {} as DmkConfig,
      "http://localhost:5000",
    );
    const result = await transport.connect({
      deviceId: "SpeculosID",
      onDisconnect: vi.fn(),
    });
    return {
      transport,
      connectedDevice: result.unsafeCoerce() as TransportConnectedDevice,
    };
  };

  describe("disconnect", () => {
    it("should stop polling the server once disconnected", async () => {
      const { transport, connectedDevice } = await connect();
      await vi.advanceTimersByTimeAsync(2000);
      expect(isServerAvailable).toHaveBeenCalledTimes(1);

      await transport.disconnect({ connectedDevice });
      isServerAvailable.mockClear();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(isServerAvailable).not.toHaveBeenCalled();
    });
  });

  describe("bearer token", () => {
    const bearerToken = "session-token";

    it("should pass the bearer token to the datasource", () => {
      new SpeculosTransport(
        loggerFactory,
        {} as DmkConfig,
        "http://localhost:5000",
        true,
        DeviceModelId.NANO_X,
        { bearerToken },
      );

      expect(HttpSpeculosDatasource).toHaveBeenCalledWith(
        "http://localhost:5000",
        undefined,
        bearerToken,
      );
    });

    it("should pass the bearer token through the factory", () => {
      speculosTransportFactory(
        "http://localhost:5001",
        true,
        DeviceModelId.NANO_X,
        { bearerToken },
      )({
        config: {} as DmkConfig,
        loggerServiceFactory: loggerFactory,
      } as unknown as TransportArgs);

      expect(HttpSpeculosDatasource).toHaveBeenCalledWith(
        "http://localhost:5001",
        undefined,
        bearerToken,
      );
    });
  });
});
