import { TransportStub } from "@api/transport/model/Transport.stub";
import { type Transport } from "@api/types";
import { type TransportService } from "@internal/transport/service/TransportService";
import { TransportServiceStub } from "@internal/transport/service/TransportService.stub";

import { StopDiscoveringUseCase } from "./StopDiscoveringUseCase";

// TODO test several transports
let transport: Transport;
let transports: Transport[];
let transportService: TransportService;

describe("StopDiscoveringUseCase", () => {
  beforeEach(() => {
    transport = new TransportStub();
    transports = [transport];
    // @ts-expect-error stub
    transportService = new TransportServiceStub(transports);
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
