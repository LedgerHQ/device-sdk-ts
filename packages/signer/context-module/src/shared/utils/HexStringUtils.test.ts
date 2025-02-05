import { HexStringUtils } from "@/shared/utils/HexStringUtils";

describe("HexStringUtils", () => {
  describe("appendSignatureToPayload", () => {
    it("should append signature to payload", () => {
      // GIVEN
      const payload = "01020304";
      const signature = "05060708";
      const tag = "15";
      // WHEN
      const result = HexStringUtils.appendSignatureToPayload(
        payload,
        signature,
        tag,
      );
      // THEN
      expect(result).toEqual("01020304150405060708");
    });

    it("should append signature to payload with odd length", () => {
      // GIVEN
      const payload = "01020304";
      const signature = "5060708";
      const tag = "15";
      // WHEN
      const result = HexStringUtils.appendSignatureToPayload(
        payload,
        signature,
        tag,
      );
      // THEN
      expect(result).toEqual("01020304150405060708");
    });
  });

  describe("stringToHex", () => {
    it("should convert string to hex", () => {
      // GIVEN
      const str = "test";
      // WHEN
      const result = HexStringUtils.stringToHex(str);
      // THEN
      expect(result).toEqual("74657374");
    });

    it("should convert string to hex with odd length", () => {
      // GIVEN
      const str = "test1";
      // WHEN
      const result = HexStringUtils.stringToHex(str);
      // THEN
      expect(result).toEqual("7465737431");
    });
  });
});
