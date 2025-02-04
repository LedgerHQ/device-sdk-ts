import { TransportMock } from "@api/transport/model/__mocks__/TransportMock";
import { type Transport } from "@api/types";
import { DefaultTransportService } from "@internal/transport/service/DefaultTransportService";
import { type TransportService } from "@internal/transport/service/TransportService";

import { StopDiscoveringUseCase } from "./StopDiscoveringUseCase";

vi.mock("@internal/transport/service/DefaultTransportService");

// TODO test several transports
let transport: Transport;
let transports: Transport[];
let transportService: TransportService;

describe("StopDiscoveringUseCase", () => {
  beforeEach(() => {
    transport = new TransportMock();
    transports = [transport];
    // @ts-expect-error mock
    transportService = new DefaultTransportService(transports);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should call stop discovering", () => {
    const mockedStopDiscovering = vi.fn();
    vi.spyOn(transport, "stopDiscovering").mockImplementation(
      mockedStopDiscovering,
    );

    vi.spyOn(transportService, "getAllTransports").mockReturnValue(transports);

    const usecase = new StopDiscoveringUseCase(transportService);

    usecase.execute();

    expect(mockedStopDiscovering).toHaveBeenCalled();
  });
});
