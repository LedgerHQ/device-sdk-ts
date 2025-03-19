import { Left } from "purify-ts";

import { type DmkConfig } from "@api/DmkConfig";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import { DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import {
  DeviceSessionNotFound,
  ReceiverApduError,
} from "@internal/device-session/model/Errors";
import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";
import { SendApduUseCase } from "@internal/send/use-case/SendApduUseCase";

vi.mock("@internal/manager-api/data/AxiosManagerApiDataSource");

let logger: LoggerPublisherService;
let sessionService: DeviceSessionService;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;
let secureChannelDataSource: SecureChannelDataSource;
let secureChannel: SecureChannelService;
const fakeSessionId = "fakeSessionId";

describe("SendApduUseCase", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], "send-apdu-use-case");
    sessionService = new DefaultDeviceSessionService(() => logger);
    managerApiDataSource = new AxiosManagerApiDataSource({} as DmkConfig);
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    secureChannelDataSource = new DefaultSecureChannelDataSource(
      {} as DmkConfig,
    );
    secureChannel = new DefaultSecureChannelService(secureChannelDataSource);
  });

  it("should send an APDU to a connected device", async () => {
    // given
    const deviceSession = deviceSessionStubBuilder(
      {},
      () => logger,
      managerApi,
      secureChannel,
      DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
    );
    sessionService.addDeviceSession(deviceSession);
    const useCase = new SendApduUseCase(sessionService, () => logger);

    // when
    const response = await useCase.execute({
      sessionId: fakeSessionId,
      apdu: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
    });

    deviceSession.close();
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
      sendApdu: vi.fn(async () =>
        Promise.resolve(Left(new ReceiverApduError())),
      ),
    });
    const deviceSession = deviceSessionStubBuilder(
      { connectedDevice },
      () => logger,
      managerApi,
      secureChannel,
      DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
    );
    sessionService.addDeviceSession(deviceSession);
    const useCase = new SendApduUseCase(sessionService, () => logger);

    // when
    const response = useCase.execute({
      sessionId: fakeSessionId,
      apdu: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
    });

    deviceSession.close();

    // then
    await expect(response).rejects.toBeInstanceOf(ReceiverApduError);
  });
});
