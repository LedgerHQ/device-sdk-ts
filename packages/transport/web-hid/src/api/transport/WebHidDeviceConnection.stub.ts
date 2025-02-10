import {
  type DeviceApduSender,
  type SendApduFnType,
} from "@ledgerhq/device-management-kit";

export class WebHidApduSenderStub implements DeviceApduSender<HIDDevice> {
  getDependencies = vi.fn();
  setDependencies = vi.fn();
  setupConnection = vi.fn();
  closeConnection = vi.fn();
  sendApdu: SendApduFnType = vi.fn();
}
