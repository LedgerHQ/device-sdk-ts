import { Maybe } from "purify-ts";
import { of } from "rxjs";

import { DeviceModel } from "@api/device/DeviceModel";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";
import { TransportStub } from "@api/transport/model/Transport.stub";
import { type TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import {
  type DeviceModelId,
  type DiscoveredDevice,
  type Transport,
} from "@api/types";
import { type TransportService } from "@internal/transport/service/TransportService";
import { TransportServiceStub } from "@internal/transport/service/TransportService.stub";

import { StartDiscoveringUseCase } from "./StartDiscoveringUseCase";

let transport: Transport;
let transportService: TransportService;

describe("StartDiscoveringUseCase", () => {
  const stubDiscoveredDevice: TransportDiscoveredDevice = {
    id: "internal-discovered-device-id",
    deviceModel: {
      id: "nanoSP" as DeviceModelId,
      productName: "productName",
    } as TransportDeviceModel,
    transport: "USB",
  };

  beforeEach(() => {
    transport = new TransportStub();
    // @ts-expect-error stub
    transportService = new TransportServiceStub();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("If connect use case encounter an error, return it", (done) => {
    const mockedStartDiscovering = jest.fn(() => {
      return of(stubDiscoveredDevice);
    });
    jest
      .spyOn(transport, "startDiscovering")
      .mockImplementation(mockedStartDiscovering);

    jest
      .spyOn(transportService, "getTransport")
      .mockReturnValue(Maybe.of(transport));

    const usecase = new StartDiscoveringUseCase(transportService);

    const discover = usecase.execute({ transport: "USB" });

    expect(mockedStartDiscovering).toHaveBeenCalled();
    discover.subscribe({
      next: (discoveredDevice) => {
        expect(discoveredDevice).toStrictEqual({
          id: "internal-discovered-device-id",
          transport: "USB",
          deviceModel: new DeviceModel({
            id: "internal-discovered-device-id",
            model: "nanoSP" as DeviceModelId,
            name: "productName",
          }),
        } as DiscoveredDevice);
        done();
      },
      error: (error) => {
        done(error);
      },
    });
  });
});
