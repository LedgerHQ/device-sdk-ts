import { Left, Right } from "purify-ts";

import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { DeviceModel } from "@internal/device-model/model/DeviceModel";
import { ConnectedDevice } from "@internal/usb/model/ConnectedDevice";
import { UnknownDeviceError } from "@internal/usb/model/Errors";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { ConnectUseCase } from "./ConnectUseCase";

let transport: WebUsbHidTransport;

describe("ConnectUseCase", () => {
  const stubConnectedDevice: ConnectedDevice = {
    id: "",
    deviceModel: {} as DeviceModel,
  };

  beforeAll(() => {
    transport = new WebUsbHidTransport({} as DeviceModelDataSource);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("If connect use case encounter an error, return it", (done) => {
    jest.spyOn(transport, "connect").mockImplementation(() => {
      return Promise.resolve(Left(new UnknownDeviceError()));
    });
    const usecase = new ConnectUseCase(transport);

    const connect = usecase.execute({ deviceId: "" });

    connect.subscribe({
      next: (connectedDevice) => {
        done(connectedDevice);
      },
      error: (error) => {
        expect(error).toBeInstanceOf(UnknownDeviceError);
        done();
      },
    });
  });

  test("If connect is in success, return an observable connected device object", (done) => {
    jest.spyOn(transport, "connect").mockImplementation(() => {
      return Promise.resolve(Right(stubConnectedDevice));
    });
    const usecase = new ConnectUseCase(transport);

    const connect = usecase.execute({ deviceId: "" });

    connect.subscribe({
      next: (connectedDevice) => {
        expect(connectedDevice).toBe(stubConnectedDevice);
        done();
      },
      error: (error) => {
        done(error);
      },
    });
  });
});
