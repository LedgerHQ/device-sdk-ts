import { Left } from "purify-ts";

import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import {
  DeviceSessionNotFound,
  ReceiverApduError,
} from "@internal/device-session/model/Errors";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { SendApduUseCase } from "@internal/send/use-case/SendApduUseCase";
import { connectedDeviceStubBuilder } from "@internal/transport/model/InternalConnectedDevice.stub";

jest.mock("@internal/manager-api/data/AxiosManagerApiDataSource");

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;
const fakeSessionId = "fakeSessionId";

describe("SendApduUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], "send-apdu-use-case");
    sessionService = new DefaultDeviceSessionService(() => logger);
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
  });

  it("should send an APDU to a connected device", async () => {
    // given
    const deviceSession = deviceSessionStubBuilder(
      {},
      () => logger,
      managerApi,
    );
    sessionService.addDeviceSession(deviceSession);
    const useCase = new SendApduUseCase(sessionService, () => logger);

    // when
    const response = await useCase.execute({
      sessionId: fakeSessionId,
      apdu: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
    });

    // then
    expect(deviceSession.connectedDevice.sendApdu).toHaveBeenCalledTimes(1);
    expect(response).toBeDefined();
  });

  it("should throw an error if the deviceSession is not found", async () => {
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
    const deviceSession = deviceSessionStubBuilder(
      { connectedDevice },
      () => logger,
      managerApi,
    );
    sessionService.addDeviceSession(deviceSession);
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
