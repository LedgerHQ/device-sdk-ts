import { Left, Right } from "purify-ts";

import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { DisconnectError } from "@internal/usb/model/Errors";
import { connectedDeviceStubBuilder } from "@internal/usb/model/InternalConnectedDevice.stub";
import { usbHidDeviceConnectionFactoryStubBuilder } from "@internal/usb/service/UsbHidDeviceConnectionFactory.stub";
import { WebUsbHidTransport } from "@internal/usb/transport/WebUsbHidTransport";

import { DisconnectUseCase } from "./DisconnectUseCase";

let sessionService: DefaultDeviceSessionService;
let usbHidTransport: WebUsbHidTransport;
const loggerFactory = jest
  .fn()
  .mockReturnValue(
    new DefaultLoggerPublisherService([], "DisconnectUseCaseTest"),
  );

const sessionId = "sessionId";

describe("DisconnectUseCase", () => {
  beforeAll(() => {
    usbHidTransport = new WebUsbHidTransport(
      {} as DeviceModelDataSource,
      loggerFactory,
      usbHidDeviceConnectionFactoryStubBuilder(),
    );
    sessionService = new DefaultDeviceSessionService(loggerFactory);
  });

  it("should disconnect from a device", async () => {
    // Given
    const connectedDevice = connectedDeviceStubBuilder();
    const deviceSession = deviceSessionStubBuilder(
      {
        id: sessionId,
        connectedDevice,
      },
      loggerFactory,
    );
    jest
      .spyOn(sessionService, "getDeviceSessionById")
      .mockImplementation(() => Right(deviceSession));
    jest.spyOn(deviceSession, "close");
    jest.spyOn(sessionService, "removeDeviceSession");
    jest
      .spyOn(usbHidTransport, "disconnect")
      .mockImplementation(() => Promise.resolve(Right(void 0)));
    const disconnectUseCase = new DisconnectUseCase(
      usbHidTransport,
      sessionService,
      loggerFactory,
    );
    // When
    await disconnectUseCase.execute({ sessionId });

    // Then
    expect(deviceSession.close).toHaveBeenCalled();
    expect(sessionService.removeDeviceSession).toHaveBeenCalledWith(sessionId);
    expect(usbHidTransport.disconnect).toHaveBeenCalledWith({
      connectedDevice,
    });
  });

  it("should throw an error when deviceSession not found", async () => {
    // Given
    const disconnectUseCase = new DisconnectUseCase(
      usbHidTransport,
      sessionService,
      loggerFactory,
    );
    // When
    try {
      await disconnectUseCase.execute({ sessionId });
    } catch (e) {
      // Then
      expect(e).toStrictEqual(new DeviceSessionNotFound());
    }
  });

  it("should throw an error if usb hid disconnection fails", async () => {
    // Given
    jest
      .spyOn(sessionService, "getDeviceSessionById")
      .mockImplementation(() =>
        Right(deviceSessionStubBuilder({ id: sessionId }, loggerFactory)),
      );
    jest
      .spyOn(usbHidTransport, "disconnect")
      .mockResolvedValue(Promise.resolve(Left(new DisconnectError())));
    const disconnectUseCase = new DisconnectUseCase(
      usbHidTransport,
      sessionService,
      loggerFactory,
    );

    // When
    try {
      await disconnectUseCase.execute({ sessionId });
    } catch (e) {
      // Then
      expect(e).toStrictEqual(new DisconnectError());
    }
  });
});
