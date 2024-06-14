import { Apdu } from "./Apdu";

describe("Apdu", () => {
  it("should create an instance", () => {
    const apdu = new Apdu(0x00, 0x00, 0x00, 0x00);
    expect(apdu).toBeInstanceOf(Apdu);
  });

  it("should return the raw APDU", () => {
    const apdu = new Apdu(0x00, 0x00, 0x00, 0x00);
    expect(apdu.getRawApdu()).toEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]),
    );
  });

  it("should return the raw APDU with data", () => {
    const apdu = new Apdu(
      0x00,
      0x00,
      0x00,
      0x00,
      new Uint8Array([0x01, 0x02, 0x03]),
    );
    expect(apdu.getRawApdu()).toEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x03, 0x01, 0x02, 0x03]),
    );
  });
});
