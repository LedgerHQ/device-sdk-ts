import { Left, Right } from "purify-ts";

import { ApduResponse } from "@api/device-session/ApduResponse";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type DeviceSession } from "@internal/device-session/model/DeviceSession";
import {
  DeviceSessionNotFound,
  ReceiverApduError,
} from "@internal/device-session/model/Errors";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { SendApduUseCase } from "@internal/send/use-case/SendApduUseCase";

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let mockDeviceSession: DeviceSession;
const fakeSessionId = "fakeSessionId";

describe("SendApduUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], "send-apdu-use-case");

    // Mock DeviceSession with sendApdu method
    mockDeviceSession = {
      sendApdu: vi.fn(),
    } as unknown as DeviceSession;

    // Mock DeviceSessionService
    sessionService = {
      getDeviceSessionById: vi.fn(),
    } as unknown as DeviceSessionService;
  });

  it("should send an APDU to a connected device", async () => {
    // given
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const expectedResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([]),
    });

    vi.mocked(sessionService.getDeviceSessionById).mockReturnValue(
      Right(mockDeviceSession),
    );
    vi.mocked(mockDeviceSession.sendApdu).mockResolvedValue(
      Right(expectedResponse),
    );

    const useCase = new SendApduUseCase(sessionService, () => logger);

    // when
    const response = await useCase.execute({
      sessionId: fakeSessionId,
      apdu,
    });

    // then
    expect(sessionService.getDeviceSessionById).toHaveBeenCalledWith(
      fakeSessionId,
    );
    expect(mockDeviceSession.sendApdu).toHaveBeenCalledWith(apdu, {
      abortTimeout: undefined,
      triggersDisconnection: undefined,
    });
    expect(response).toBe(expectedResponse);
  });

  it("should throw an error if the deviceSession is not found", async () => {
    // given
    const notFoundError = new DeviceSessionNotFound();
    vi.mocked(sessionService.getDeviceSessionById).mockReturnValue(
      Left(notFoundError),
    );

    const useCase = new SendApduUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
      apdu: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
    });

    // then
    await expect(response).rejects.toBe(notFoundError);
    expect(sessionService.getDeviceSessionById).toHaveBeenCalledWith(
      fakeSessionId,
    );
  });

  it("should throw an error if the apdu receiver failed", async () => {
    // given
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const receiverError = new ReceiverApduError();

    vi.mocked(sessionService.getDeviceSessionById).mockReturnValue(
      Right(mockDeviceSession),
    );
    vi.mocked(mockDeviceSession.sendApdu).mockResolvedValue(
      Left(receiverError),
    );

    const useCase = new SendApduUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
      apdu,
    });

    // then
    await expect(response).rejects.toBe(receiverError);
    expect(sessionService.getDeviceSessionById).toHaveBeenCalledWith(
      fakeSessionId,
    );
    expect(mockDeviceSession.sendApdu).toHaveBeenCalledWith(apdu, {
      abortTimeout: undefined,
      triggersDisconnection: undefined,
    });
  });
});
