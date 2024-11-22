import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import {
  DeviceSession,
  type SessionConstructorArgs,
} from "@internal/device-session/model/DeviceSession";
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
