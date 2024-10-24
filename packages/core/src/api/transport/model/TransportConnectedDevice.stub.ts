import { Right } from "purify-ts";

import { deviceModelStubBuilder } from "@api/device-model/model/DeviceModel.stub";
import { defaultApduResponseStubBuilder } from "@api/device-session/ApduResponse.stub";

import {
  type ConnectedDeviceConstructorArgs,
  TransportConnectedDevice,
} from "./TransportConnectedDevice";

export function connectedDeviceStubBuilder(
  props: Partial<ConnectedDeviceConstructorArgs> = {},
): TransportConnectedDevice {
  const deviceModel = deviceModelStubBuilder();
  return new TransportConnectedDevice({
    deviceModel,
    id: "42",
    type: "MOCK",
    transport: "USB",
    sendApdu: jest.fn(async () =>
      Promise.resolve(Right(defaultApduResponseStubBuilder())),
    ),
    ...props,
  });
}
