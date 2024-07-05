import { isHexString } from "./HexString";

describe("HexString", () => {
  describe("isHexString function", () => {
    it("should return true if the value is a valid hex string", () => {
      // GIVEN
      const value = "0x1234abc";

      // WHEN
      const result = isHexString(value);

      // THEN
      expect(result).toBeTruthy();
    });

    it("should return true if no data", () => {
      // GIVEN
      const value = "0x";

      // WHEN
      const result = isHexString(value);

      // THEN
      expect(result).toBeTruthy();
    });

    it("should return false if the value contain an invalid letter", () => {
      // GIVEN
      const value = "0x1234z";

      // WHEN
      const result = isHexString(value);

      // THEN
      expect(result).toBeFalsy();
    });

    it("should return false if the value does not start with 0x", () => {
      // GIVEN
      const value = "1234abc";

      // WHEN
      const result = isHexString(value);

      // THEN
      expect(result).toBeFalsy();
    });

    it("should return false for an epmty string", () => {
      // GIVEN
      const value = "";

      // WHEN
      const result = isHexString(value);

      // THEN
      expect(result).toBeFalsy();
    });
  });
});
