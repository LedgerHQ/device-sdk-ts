import { Right } from "purify-ts";

import { deviceModelStubBuilder } from "@internal/device-model/model/DeviceModel.stub";
import { defaultApduResponseStubBuilder } from "@internal/device-session/model/ApduResponse.stub";
import { ConnectedDevice } from "@internal/usb/model/ConnectedDevice";

export function connectedDeviceBuilder(
  id = "42",
  type: "USB" | "BLE" | "MOCK" = "USB",
): ConnectedDevice {
  const deviceModel = deviceModelStubBuilder();
  return new ConnectedDevice({
    deviceModel,
    id,
    type,
    sendApdu: async () =>
      Promise.resolve(Right(defaultApduResponseStubBuilder())),
  });
}
