import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import {
  mockserverIdentifier,
  mockserverTransportFactory,
} from "./MockserverTransport";

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

describe("mockserverTransportFactory", () => {
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
});
