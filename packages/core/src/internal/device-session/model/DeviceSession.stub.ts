import {
  DeviceSession,
  SessionConstructorArgs,
} from "@internal/device-session/model/DeviceSession";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { connectedDeviceStubBuilder } from "@internal/usb/model/InternalConnectedDevice.stub";

export const deviceSessionStubBuilder = (
  props: Partial<SessionConstructorArgs> = {},
  loggerFactory: (tag: string) => LoggerPublisherService,
) =>
  new DeviceSession(
    {
      connectedDevice: connectedDeviceStubBuilder(),
      id: "fakeSessionId",
      ...props,
    },
    loggerFactory,
  );
