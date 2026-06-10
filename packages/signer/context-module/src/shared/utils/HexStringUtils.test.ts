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

  describe("hexToBytes", () => {
    it("decodes a plain hex string into Uint8Array", () => {
      expect(HexStringUtils.hexToBytes("deadbeef")).toEqual(
        new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      );
    });

    it("strips a 0x prefix", () => {
      expect(HexStringUtils.hexToBytes("0xCAFEBABE")).toEqual(
        new Uint8Array([0xca, 0xfe, 0xba, 0xbe]),
      );
    });

    it("throws on the empty string", () => {
      expect(() => HexStringUtils.hexToBytes("")).toThrow(/empty hex string/);
    });

    it("throws on a bare `0x` prefix with no payload", () => {
      expect(() => HexStringUtils.hexToBytes("0x")).toThrow(/empty hex string/);
    });

    it("throws on odd-length input", () => {
      expect(() => HexStringUtils.hexToBytes("abc")).toThrow(/odd-length/);
    });

    it("throws on non-hex characters", () => {
      expect(() => HexStringUtils.hexToBytes("zzzz")).toThrow(/non-hex/);
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
