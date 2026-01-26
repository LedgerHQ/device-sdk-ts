import { type DmkConfig } from "@api/DmkConfig";
import { connectedDeviceStubBuilder } from "@api/index";
import { DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";

import { DeviceSession } from "./DeviceSession";

describe("DeviceSession", () => {
  it("should unsubscribe pinger from event subscriber when session is closed", () => {
    // ARRANGE
    const logger = new DefaultLoggerPublisherService([], "DeviceSession");
    const managerApiDataSource = new AxiosManagerApiDataSource({} as DmkConfig);
    const managerApi = new DefaultManagerApiService(managerApiDataSource);
    const secureChannelDataSource = new DefaultSecureChannelDataSource(
      {} as DmkConfig,
    );
    const secureChannel = new DefaultSecureChannelService(
      secureChannelDataSource,
    );
    const deviceSessionRefresherOptions =
      DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS;
    const deviceSession = new DeviceSession(
      { connectedDevice: connectedDeviceStubBuilder() },
      () => logger,
      managerApi,
      secureChannel,
      deviceSessionRefresherOptions,
    );
    const unsubscribe = vi
      .spyOn(deviceSession["_pinger"], "unsubscribe")
      .mockImplementation(() => {});

    // ACT
    deviceSession.close();

    // ASSERT
    expect(unsubscribe).toHaveBeenCalled();
  });
});
