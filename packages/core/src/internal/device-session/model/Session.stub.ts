import {
  Session,
  SessionConstructorArgs,
} from "@internal/device-session/model/Session";
import { connectedDeviceStubBuilder } from "@internal/usb/model/InternalConnectedDevice.stub";

export const sessionStubBuilder = (
  props: Partial<SessionConstructorArgs> = {},
) =>
  new Session({
    connectedDevice: connectedDeviceStubBuilder(),
    id: "fakeSessionId",
    ...props,
  });
