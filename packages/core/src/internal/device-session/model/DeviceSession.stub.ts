import {
  DeviceSession,
  SessionConstructorArgs,
} from "@internal/device-session/model/DeviceSession";
import { connectedDeviceStubBuilder } from "@internal/usb/model/InternalConnectedDevice.stub";

export const deviceSessionStubBuilder = (
  props: Partial<SessionConstructorArgs> = {},
) =>
  new DeviceSession({
    connectedDevice: connectedDeviceStubBuilder(),
    id: "fakeSessionId",
    ...props,
  });
