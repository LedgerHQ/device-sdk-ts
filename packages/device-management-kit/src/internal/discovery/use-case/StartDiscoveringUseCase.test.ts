import { Maybe } from "purify-ts";
import { of } from "rxjs";

import { DeviceModel } from "@api/device/DeviceModel";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";
import { TransportMock } from "@api/transport/model/__mocks__/TransportMock";
import { type TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import {
  type DeviceModelId,
  type DiscoveredDevice,
  type Transport,
} from "@api/types";
import { DefaultTransportService } from "@internal/transport/service/DefaultTransportService";
import { type TransportService } from "@internal/transport/service/TransportService";

import { StartDiscoveringUseCase } from "./StartDiscoveringUseCase";

vi.mock("@internal/transport/service/DefaultTransportService");

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
    rssi: undefined,
  };

  beforeEach(() => {
    transport = new TransportMock();
    // @ts-expect-error mock
    transportService = new DefaultTransportService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("If connect use case encounter an error, return it", () =>
    new Promise<void>((resolve, reject) => {
      const mockedStartDiscovering = vi.fn(() => {
        return of(stubDiscoveredDevice);
      });
      vi.spyOn(transport, "startDiscovering").mockImplementation(
        mockedStartDiscovering,
      );

      vi.spyOn(transportService, "getTransport").mockReturnValue(
        Maybe.of(transport),
      );

      const usecase = new StartDiscoveringUseCase(transportService);

      const discover = usecase.execute({ transport: "USB" });

      expect(mockedStartDiscovering).toHaveBeenCalled();

      discover.subscribe({
        next: (discoveredDevice) => {
          try {
            expect(discoveredDevice).toStrictEqual({
              id: "internal-discovered-device-id",
              transport: "USB",
              name: "productName",
              deviceModel: new DeviceModel({
                id: "internal-discovered-device-id",
                model: "nanoSP" as DeviceModelId,
                name: "productName",
              }),
              rssi: undefined,
            } as DiscoveredDevice);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(error);
        },
      });
    }));
});
