import { Session } from "@internal/device-session/model/Session";
import { connectedDeviceStubBuilder } from "@internal/usb/model/ConnectedDevice.stub";

export const sessionStubBuilder = () =>
  new Session({
    connectedDevice: connectedDeviceStubBuilder(),
  });
