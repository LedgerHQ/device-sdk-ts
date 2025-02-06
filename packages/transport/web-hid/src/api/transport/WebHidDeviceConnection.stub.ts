import {
  type DeviceApduSender,
  type SendApduFnType,
} from "@ledgerhq/device-management-kit";

export class WebHidDeviceConnectionStub implements DeviceApduSender<HIDDevice> {
  getDevice = vi.fn();
  setDevice = vi.fn();
  closeConnection = vi.fn();
  sendApdu: SendApduFnType = vi.fn();
}
