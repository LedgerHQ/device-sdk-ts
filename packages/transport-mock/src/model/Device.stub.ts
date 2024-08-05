import { Device, DeviceArgs } from "./Device";

export const deviceStubBuilder = (args: Partial<DeviceArgs> = {}) =>
  new Device({
    id: "42",
    name: "DEVICE_TEST",
    device_type: "TEST",
    connectivity_type: "USB",
    ...args,
  });
