import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import {
  DeviceSession,
  type SessionConstructorArgs,
} from "@internal/device-session/model/DeviceSession";
import { type LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import type { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

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
