import { Left } from "purify-ts";

import {
  DeviceSessionNotFound,
  ReceiverApduError,
} from "@internal/device-session/model/Errors";
import { sessionStubBuilder } from "@internal/device-session/model/Session.stub";
import { DefaultSessionService } from "@internal/device-session/service/DefaultSessionService";
import { SessionService } from "@internal/device-session/service/SessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { SendApduUseCase } from "@internal/send/use-case/SendApduUseCase";
import { connectedDeviceStubBuilder } from "@internal/usb/model/InternalConnectedDevice.stub";

let logger: LoggerPublisherService;
let sessionService: SessionService;
const fakeSessionId = "fakeSessionId";

describe("SendApduUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], "send-apdu-use-case");
    sessionService = new DefaultSessionService(() => logger);
  });

  it("should send an APDU to a connected device", async () => {
    // given
    const session = sessionStubBuilder();
    sessionService.addSession(session);
    const useCase = new SendApduUseCase(sessionService, () => logger);

    // when
    const response = await useCase.execute({
      sessionId: fakeSessionId,
      apdu: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
    });

    // then
    expect(session.connectedDevice.sendApdu).toHaveBeenCalledTimes(1);
    expect(response).toBeDefined();
  });

  it("should throw an error if the session is not found", async () => {
    // given
    const useCase = new SendApduUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
      apdu: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
    });

    // then
    await expect(response).rejects.toBeInstanceOf(DeviceSessionNotFound);
  });

  it("should throw an error if the apdu receiver failed", async () => {
    // given
    const connectedDevice = connectedDeviceStubBuilder({
      sendApdu: jest.fn(async () =>
        Promise.resolve(Left(new ReceiverApduError())),
      ),
    });
    const session = sessionStubBuilder({ connectedDevice });
    sessionService.addSession(session);
    const useCase = new SendApduUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
      apdu: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
    });

    // then
    await expect(response).rejects.toBeInstanceOf(ReceiverApduError);
  });
});
