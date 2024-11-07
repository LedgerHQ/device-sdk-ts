import { TransportMock } from "@api/transport/model/__mocks__/TransportMock";
import { type Transport } from "@api/types";
import { TransportService } from "@internal/transport/service/TransportService";

import { StopDiscoveringUseCase } from "./StopDiscoveringUseCase";

jest.mock("@internal/transport/service/TransportService");

// TODO test several transports
let transport: Transport;
let transports: Transport[];
let transportService: TransportService;

describe("StopDiscoveringUseCase", () => {
  beforeEach(() => {
    transport = new TransportMock();
    transports = [transport];
    // @ts-expect-error mock
    transportService = new TransportService(transports);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should call stop discovering", () => {
    const mockedStopDiscovering = jest.fn();
    jest
      .spyOn(transport, "stopDiscovering")
      .mockImplementation(mockedStopDiscovering);

    jest
      .spyOn(transportService, "getAllTransports")
      .mockReturnValue(transports);

    const usecase = new StopDiscoveringUseCase(transportService);

    usecase.execute();

    expect(mockedStopDiscovering).toHaveBeenCalled();
  });
});
