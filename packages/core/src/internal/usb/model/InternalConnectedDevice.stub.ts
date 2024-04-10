import { Right } from "purify-ts";

import { deviceModelStubBuilder } from "@internal/device-model/model/DeviceModel.stub";
import { defaultApduResponseStubBuilder } from "@internal/device-session/model/ApduResponse.stub";
import {
  ConnectedDeviceConstructorArgs,
  InternalConnectedDevice,
} from "@internal/usb/model/InternalConnectedDevice";

export function connectedDeviceStubBuilder(
  props: Partial<ConnectedDeviceConstructorArgs> = {},
): InternalConnectedDevice {
  const deviceModel = deviceModelStubBuilder();
  return new InternalConnectedDevice({
    deviceModel,
    id: "42",
    type: "MOCK",
    sendApdu: jest.fn(async () =>
      Promise.resolve(Right(defaultApduResponseStubBuilder())),
    ),
    ...props,
  });
}
