import {
  type DeviceConnection,
  type SendApduFnType,
} from "@ledgerhq/device-management-kit";

export class WebHidDeviceConnectionStub implements DeviceConnection {
  sendApdu: SendApduFnType = jest.fn();
}
