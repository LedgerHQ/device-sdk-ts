import type { Device as NodeHIDDevice } from "node-hid";

export const nodeHidDeviceStubBuilder = (
  props: Partial<NodeHIDDevice> = {},
): NodeHIDDevice => ({
  vendorId: 0x2c97,
  productId: 0x4011,
  path: "/dev/hidraw0",
  manufacturer: "Ledger",
  product: "Ledger Nano X",
  release: 0x0100,
  interface: 0,
  usagePage: 0xffa0,
  usage: 0x0001,
  ...props,
});
