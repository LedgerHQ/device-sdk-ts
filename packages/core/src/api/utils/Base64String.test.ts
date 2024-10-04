import { base64StringToBuffer, isBase64String } from "./Base64String";

describe("Base64String", () => {
  describe("isBase64String function", () => {
    it("should return true if the value is a valid base64 string", () => {
      // GIVEN
      const value = "Zmlyc3QgdG/zdGluZyBz+HI9";

      // WHEN
      const result = isBase64String(value);

      // THEN
      expect(result).toBeTruthy();
    });

    it("should return true if the value is a valid base64 string, one padding", () => {
      // GIVEN
      const value = "Zmlyc3QgdGVzdGluZyBzdHI=";

      // WHEN
      const result = isBase64String(value);

      // THEN
      expect(result).toBeTruthy();
    });

    it("should return true if the value is a valid base64 string, two paddings", () => {
      // GIVEN
      const value = "Zmlyc3QgdGVzdGluZyBzdH==";

      // WHEN
      const result = isBase64String(value);

      // THEN
      expect(result).toBeTruthy();
    });

    it("should return true for an empty string", () => {
      // GIVEN
      const value = "";

      // WHEN
      const result = isBase64String(value);

      // THEN
      expect(result).toBeTruthy();
    });

    it("should return false for an invalid base64 string", () => {
      // GIVEN
      const value = "invalid base64 string";

      // WHEN
      const result = isBase64String(value);

      // THEN
      expect(result).toBeFalsy();
    });

    it("should return false with 3 paddings", () => {
      // GIVEN
      const value = "Zmlyc3QgdGVzdGluZyBzd===";

      // WHEN
      const result = isBase64String(value);

      // THEN
      expect(result).toBeFalsy();
    });

    it("should return false on incomplete string (not multiple of 4)", () => {
      // GIVEN
      const value = "Zmlyc3QgdGVzdGluZyBzdHI";

      // WHEN
      const result = isBase64String(value);

      // THEN
      expect(result).toBeFalsy();
    });
  });

  describe("base64StringToBuffer function", () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it("should convert empty input to empty buffer", () => {
      // GIVEN
      const value = "";

      // WHEN
      const result = base64StringToBuffer(value);

      // THEN
      expect(result).toStrictEqual(new Uint8Array());
    });

    it("invalid base64 string converted to null", () => {
      // GIVEN
      const value = "invalid string";

      // WHEN
      const result = base64StringToBuffer(value);

      // THEN
      expect(result).toStrictEqual(null);
    });

    it("should convert a base64 string to a buffer using browser's atob", () => {
      // GIVEN
      const value = "Zmlyc3QgdGVzdCBzdHJpbmc=";

      // WHEN
      const result = base64StringToBuffer(value);

      // THEN
      expect(result).toStrictEqual(
        Uint8Array.from([
          0x66, 0x69, 0x72, 0x73, 0x74, 0x20, 0x74, 0x65, 0x73, 0x74, 0x20,
          0x73, 0x74, 0x72, 0x69, 0x6e, 0x67,
        ]),
      );
    });

    it("should convert a base64 string to a buffer using Buffer", () => {
      // GIVEN
      jest.spyOn(global, "atob").mockImplementation(() => {
        throw new Error("atob is not defined");
      });
      const value = "Zmlyc3QgdGVzdCBzdHJpbmc=";

      // WHEN
      const result = base64StringToBuffer(value);

      // THEN
      expect(result).toStrictEqual(
        Uint8Array.from([
          0x66, 0x69, 0x72, 0x73, 0x74, 0x20, 0x74, 0x65, 0x73, 0x74, 0x20,
          0x73, 0x74, 0x72, 0x69, 0x6e, 0x67,
        ]),
      );
    });
  });
});
