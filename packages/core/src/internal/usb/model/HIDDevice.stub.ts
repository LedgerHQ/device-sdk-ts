const oninputreport = jest.fn().mockResolvedValue(void 0);
export const hidDeviceStubBuilder = (
  props: Partial<HIDDevice> = {},
): HIDDevice => ({
  opened: false,
  productId: 0x4011,
  vendorId: 0x2c97,
  productName: "Ledger Nano X",
  collections: [],
  open: jest.fn(),
  oninputreport,
  close: jest.fn(),
  sendReport: jest.fn().mockResolvedValue(oninputreport()),
  sendFeatureReport: jest.fn(),
  forget: jest.fn(),
  receiveFeatureReport: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  ...props,
});
