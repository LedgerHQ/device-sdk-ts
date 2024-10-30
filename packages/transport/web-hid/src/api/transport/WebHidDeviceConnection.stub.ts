import { DeviceConnection } from "@ledgerhq/device-management-kit";
import { SendApduFnType } from "@ledgerhq/device-management-kit/src/api/transport/model/DeviceConnection.js";

export class WebHidDeviceConnectionStub implements DeviceConnection {
  sendApdu: SendApduFnType = jest.fn();
}
