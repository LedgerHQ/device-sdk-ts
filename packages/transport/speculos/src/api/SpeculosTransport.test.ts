import {
  type DmkConfig,
  type LoggerPublisherService,
  type TransportConnectedDevice,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpeculosTransport } from "@api/SpeculosTransport";

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
});
