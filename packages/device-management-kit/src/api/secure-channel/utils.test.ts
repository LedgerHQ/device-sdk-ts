import { isDeviceGenuine, willRequestPermission } from "./utils";

describe("willRequestPermission", () => {
  it("should return true if the APDU is a permission request", () => {
    const apdu = new Uint8Array([0xe0, 0x51, 0x00, 0x00, 0x00]);
    expect(willRequestPermission(apdu)).toBe(true);
  });
  it("should return false if the APDU is not a permission request", () => {
    const apdu = new Uint8Array([0xe0, 0x52, 0x00, 0x00, 0x00]);
    expect(willRequestPermission(apdu)).toBe(false);
  });
});

describe("isDeviceGenuine", () => {
  it("should return true if the device is genuine", () => {
    const payload = "0000";
    expect(isDeviceGenuine(payload)).toBe(true);
  });
  it("should return false if the device is not genuine", () => {
    const payload = "not genuine";
    expect(isDeviceGenuine(payload)).toBe(false);
  });
});
