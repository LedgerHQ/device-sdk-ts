import {
  type DeviceConnection,
  type SendApduFnType,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

export class WebHidDeviceConnectionStub implements DeviceConnection {
  sendApdu: SendApduFnType = vi.fn();
}
