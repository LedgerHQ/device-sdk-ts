import {
  DeviceSession,
  SessionConstructorArgs,
} from "@internal/device-session/model/DeviceSession";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import type { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { connectedDeviceStubBuilder } from "@internal/transport/model/InternalConnectedDevice.stub";

export const deviceSessionStubBuilder = (
  props: Partial<SessionConstructorArgs> = {},
  loggerFactory: (tag: string) => LoggerPublisherService,
  managerApi: ManagerApiService,
) =>
  new DeviceSession(
    {
      connectedDevice: connectedDeviceStubBuilder(),
      id: "fakeSessionId",
      ...props,
    },
    loggerFactory,
    managerApi,
  );
