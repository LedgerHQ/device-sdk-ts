import { ApduResponse } from "@api/device-session/ApduResponse";

import {
  extractPublicKey,
  isDeviceGenuine,
  isGetCertificateApdu,
  willRequestPermission,
} from "./utils";

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

describe("isGetCertificateApdu", () => {
  it("should return true if the APDU is a GetCertificate command", () => {
    const apdu = new Uint8Array([0xe0, 0x52, 0x00, 0x00, 0x00]);
    expect(isGetCertificateApdu(apdu)).toBe(true);
  });
  it("should return true for GetCertificate with different P1 and P2", () => {
    const apdu = new Uint8Array([0xe0, 0x52, 0x80, 0x01, 0x00]);
    expect(isGetCertificateApdu(apdu)).toBe(true);
  });
  it("should return false if the APDU is not a GetCertificate command", () => {
    const apdu = new Uint8Array([0xe0, 0x51, 0x00, 0x00, 0x00]);
    expect(isGetCertificateApdu(apdu)).toBe(false);
  });
});

describe("extractPublicKey", () => {
  it("should extract public key from a valid GetCertificate response", () => {
    const responseData = new Uint8Array([
      0x07, 0x4a, 0x07, 0xa1, 0x52, 0xe6, 0xbb, 0xc1, 0x41, 0x04, 0x1c, 0x74,
      0x7a, 0x4e, 0x08, 0x1b, 0x5c, 0x1e, 0xd0, 0x27, 0xfc, 0xaf, 0x80, 0xda,
      0xda, 0x1f, 0x84, 0xfc, 0x8e, 0x43, 0x60, 0xcb, 0x53, 0xc4, 0xb6, 0x9e,
      0x63, 0xcb, 0x91, 0xb7, 0xca, 0xd3, 0x15, 0x63, 0x68, 0x59, 0x1b, 0xfb,
      0x05, 0x8f, 0x72, 0x0f, 0x97, 0xaf, 0xc4, 0x73, 0xf9, 0x78, 0x55, 0xfb,
      0x96, 0xe4, 0x54, 0xd4, 0x80, 0x18, 0x16, 0x00, 0x34, 0x9f, 0xd8, 0xdc,
      0x12, 0x51, 0x46, 0x30, 0x44, 0x02, 0x20, 0x7e, 0x3c, 0xdd, 0x1d, 0x15,
      0x08, 0xf6, 0x8d, 0x16, 0x63, 0x4a, 0x3a, 0x1e, 0xe1, 0x97, 0xc4, 0x50,
      0xc9, 0x17, 0x65, 0xe5, 0xe2, 0x48, 0x24, 0x17, 0xb2, 0x5e, 0xe3, 0xa0,
      0x19, 0x81, 0xc8, 0x02, 0x20, 0x59, 0x79, 0x5d, 0x09, 0x29, 0xc7, 0xd8,
      0x4b, 0xad, 0xad, 0xe5, 0x05, 0x0e, 0x3b, 0x21, 0x19, 0x7d, 0xaa, 0xff,
      0xa3, 0x29, 0xea, 0x07, 0xd5, 0xb4, 0x29, 0x1c, 0xa6, 0xe9, 0x2a, 0x72,
      0xd9,
    ]);

    const response = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: responseData,
    });

    const publicKey = extractPublicKey(response);

    expect(publicKey).not.toBeNull();
    expect(publicKey?.length).toBe(65);
    expect(publicKey?.[0]).toBe(0x04);
    expect(publicKey?.[64]).toBe(0x51);
  });

  it("should return null for invalid response with missing header", () => {
    const response = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([]),
    });

    const publicKey = extractPublicKey(response);

    expect(publicKey).toBeNull();
  });

  it("should return null for invalid response with missing public key", () => {
    const responseData = new Uint8Array([
      0x07, 0x4a, 0x07, 0xa1, 0x52, 0xe6, 0xbb, 0xc1,
    ]);

    const response = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: responseData,
    });

    const publicKey = extractPublicKey(response);

    expect(publicKey).toBeNull();
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
