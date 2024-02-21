import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { StopDiscoveringUseCase } from "./StopDiscoveringUseCase";

let transport: WebUsbHidTransport;

describe("StopDiscoveringUseCase", () => {
  beforeEach(() => {
    transport = new WebUsbHidTransport({} as DeviceModelDataSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should call stop discovering", () => {
    const mockedStopDiscovering = jest.fn();
    jest
      .spyOn(transport, "stopDiscovering")
      .mockImplementation(mockedStopDiscovering);
    const usecase = new StopDiscoveringUseCase(transport);

    usecase.execute();

    expect(mockedStopDiscovering).toHaveBeenCalled();
  });
});
