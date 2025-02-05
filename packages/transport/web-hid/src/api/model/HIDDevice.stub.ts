const oninputreport = vi.fn().mockResolvedValue(void 0);

export const hidDeviceStubBuilder = (
  props: Partial<HIDDevice> = {},
): HIDDevice => ({
  opened: false,
  productId: 0x4011,
  vendorId: 0x2c97,
  productName: "Ledger Nano X",
  collections: [],
  open: vi.fn().mockResolvedValue(undefined),
  oninputreport,
  close: vi.fn().mockResolvedValue(undefined),
  sendReport: vi.fn().mockResolvedValue(oninputreport()),
  sendFeatureReport: vi.fn(),
  forget: vi.fn(),
  receiveFeatureReport: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  ...props,
});
