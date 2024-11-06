import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { GetDeviceSessionStateUseCase } from "./GetDeviceSessionStateUseCase";

jest.mock("@internal/manager-api/data/AxiosManagerApiDataSource");

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;

const fakeSessionId = "fakeSessionId";

describe("GetDeviceSessionStateUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService(
      [],
      "get-connected-device-use-case-test",
    );
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    sessionService = new DefaultDeviceSessionService(() => logger);
  });

  // TODO: This test does not close a subscription
  // ¯\_(ツ)_/¯ I cannot find which one unfortunatly
  it("should retrieve deviceSession device state", () => {
    // given
    const deviceSession = deviceSessionStubBuilder(
      { id: fakeSessionId },
      () => logger,
      managerApi,
    );
    sessionService.addDeviceSession(deviceSession);
    const useCase = new GetDeviceSessionStateUseCase(
      sessionService,
      () => logger,
    );

    const res = useCase.execute({ sessionId: fakeSessionId });
    const expected = deviceSession.state;

<<<<<<< HEAD
    deviceSession.close();

    // then
    expect(response).toStrictEqual(deviceSession.state);
||||||| parent of 61c06245 (✅ (dmk): Add tests for TransportService + fixes)
    // then
    expect(response).toStrictEqual(deviceSession.state);
=======
    expect(res).toStrictEqual(expected);
>>>>>>> 61c06245 (✅ (dmk): Add tests for TransportService + fixes)
  });

  it("should throw error when deviceSession is not found", (done) => {
    // given
    const useCase = new GetDeviceSessionStateUseCase(
      sessionService,
      () => logger,
    );

    // when
    try {
      useCase
        .execute({
          sessionId: fakeSessionId,
        })
        .subscribe();
    } catch (error) {
      // then
      expect(error).toBeInstanceOf(DeviceSessionNotFound);
      done();
    }
  });
});
