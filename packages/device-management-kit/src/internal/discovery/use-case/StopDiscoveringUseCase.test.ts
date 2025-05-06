import { TransportMock } from "@api/transport/model/__mocks__/TransportMock";
import { type LoggerPublisherService, type Transport } from "@api/types";
import { DefaultTransportService } from "@internal/transport/service/DefaultTransportService";
import { type TransportService } from "@internal/transport/service/TransportService";

import { StopDiscoveringUseCase } from "./StopDiscoveringUseCase";

vi.mock("@internal/transport/service/DefaultTransportService");

// TODO test several transports
let transport: Transport;
let transport2: Transport;
let transports: Transport[];
let transportService: TransportService;
let logger: LoggerPublisherService;

describe("StopDiscoveringUseCase", () => {
  beforeEach(() => {
    transport = new TransportMock();
    transport2 = new TransportMock();
    transports = [transport, transport2];
    logger = {
      debug: vi.fn(),
    } as unknown as LoggerPublisherService;
    // @ts-expect-error mock
    transportService = new DefaultTransportService(transports);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should call stop discovering", async () => {
    vi.spyOn(transport, "stopDiscovering").mockImplementation(vi.fn());
    vi.spyOn(transport2, "stopDiscovering").mockImplementation(async () =>
      Promise.resolve(undefined),
    );

    vi.spyOn(transportService, "getAllTransports").mockReturnValue(transports);

    const usecase = new StopDiscoveringUseCase(
      transportService,
      vi.fn().mockImplementation(() => logger),
    );

    await usecase.execute();

    expect(transport.stopDiscovering).toHaveBeenCalled();
    expect(transport2.stopDiscovering).toHaveBeenCalled();
  });
});
