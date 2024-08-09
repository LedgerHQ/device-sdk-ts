import { hexaStringToBuffer, isHexaString } from "./HexaString";

describe("HexaString", () => {
  describe("isHexaString function", () => {
    it("should return true if the value is a valid hex string", () => {
      // GIVEN
      const value = "0x1234abc";

      // WHEN
      const result = isHexaString(value);

      // THEN
      expect(result).toBeTruthy();
    });

    it("should return true if no data", () => {
      // GIVEN
      const value = "0x";

      // WHEN
      const result = isHexaString(value);

      // THEN
      expect(result).toBeTruthy();
    });

    it("should return false if the value contain an invalid letter", () => {
      // GIVEN
      const value = "0x1234z";

      // WHEN
      const result = isHexaString(value);

      // THEN
      expect(result).toBeFalsy();
    });

    it("should return false if the value does not start with 0x", () => {
      // GIVEN
      const value = "1234abc";

      // WHEN
      const result = isHexaString(value);

      // THEN
      expect(result).toBeFalsy();
    });

    it("should return false for an epmty string", () => {
      // GIVEN
      const value = "";

      // WHEN
      const result = isHexaString(value);

      // THEN
      expect(result).toBeFalsy();
    });
  });

  describe("hexaStringToBuffer function", () => {
    it("should fail on empty input", () => {
      // GIVEN
      const value = "";

      // WHEN
      const result = hexaStringToBuffer(value);

      // THEN
      expect(result).toStrictEqual(null);
    });

    it("should fail on invalid string", () => {
      // GIVEN
      const value = "bonjour";

      // WHEN
      const result = hexaStringToBuffer(value);

      // THEN
      expect(result).toStrictEqual(null);
    });

    it("should convert correct hexadecimal string", () => {
      // GIVEN
      const value = "1a35669f0100";

      // WHEN
      const result = hexaStringToBuffer(value);

      // THEN
      expect(result).toStrictEqual(
        new Uint8Array([0x1a, 0x35, 0x66, 0x9f, 0x01, 0x00]),
      );
    });

    it("should support 0x prefix", () => {
      // GIVEN
      const value = "0x1a35";

      // WHEN
      const result = hexaStringToBuffer(value);

      // THEN
      expect(result).toStrictEqual(new Uint8Array([0x1a, 0x35]));
    });

    it("should be case insensitive", () => {
      // GIVEN
      const value = "0xcCDd";

      // WHEN
      const result = hexaStringToBuffer(value);

      // THEN
      expect(result).toStrictEqual(new Uint8Array([0xcc, 0xdd]));
    });

    it("should pad with 0", () => {
      // GIVEN
      const value = "0xa35";

      // WHEN
      const result = hexaStringToBuffer(value);

      // THEN
      expect(result).toStrictEqual(new Uint8Array([0x0a, 0x35]));
    });
  });
});
