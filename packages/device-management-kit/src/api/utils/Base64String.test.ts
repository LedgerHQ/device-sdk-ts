/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  base64StringToBuffer,
  bufferToBase64String,
  isBase64String,
} from "./Base64String";

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
      vi.resetAllMocks();
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
      vi.spyOn(global, "atob").mockImplementation(() => {
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

describe("bufferToBase64String", () => {
  const originalBtoa = (globalThis as any).btoa;
  const originalBuffer = (globalThis as any).Buffer;

  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).btoa = originalBtoa;
    (globalThis as any).Buffer = originalBuffer;
  });

  afterAll(() => {
    (globalThis as any).btoa = originalBtoa;
    (globalThis as any).Buffer = originalBuffer;
  });

  it("should encode an empty buffer to an empty base64 string when btoa is available", () => {
    // GIVEN
    (globalThis as any).btoa = vi.fn((input: string) => {
      expect(input).toBe("");
      return "";
    });

    const bytes = new Uint8Array();

    // WHEN
    const result = bufferToBase64String(bytes);

    // THEN
    expect(result).toBe("");
    expect(globalThis.btoa).toHaveBeenCalledTimes(1);
  });

  it("should encode a buffer to base64 using btoa when available", () => {
    // GIVEN
    const text = "first testing str";
    const bytes = Uint8Array.from(text.split("").map((c) => c.charCodeAt(0)));

    (globalThis as any).btoa = vi.fn((input: string) => {
      expect(input).toBe(text);
      return "Zmlyc3QgdGVzdGluZyBzdHI=";
    });

    // WHEN
    const result = bufferToBase64String(bytes);

    // THEN
    expect(result).toBe("Zmlyc3QgdGVzdGluZyBzdHI=");
    expect(globalThis.btoa).toHaveBeenCalledTimes(1);
  });

  it("should encode a buffer to base64 using Buffer when btoa is not available", () => {
    // GIVEN
    (globalThis as any).btoa = undefined;

    const text = "testing str";
    const expectedBase64 = Buffer.from(text, "binary").toString("base64");
    const bytes = Uint8Array.from(text.split("").map((c) => c.charCodeAt(0)));

    const bufferFromSpy = vi.spyOn(Buffer, "from");

    // WHEN
    const result = bufferToBase64String(bytes);

    // THEN
    expect(result).toBe(expectedBase64);
    expect(bufferFromSpy).toHaveBeenCalledTimes(1);
  });

  it("should throw an error when no Base64 encoder is available", () => {
    // GIVEN
    (globalThis as any).btoa = undefined;
    (globalThis as any).Buffer = undefined;

    const bytes = Uint8Array.from([0x01, 0x02, 0x03]);

    // WHEN / THEN
    expect(() => bufferToBase64String(bytes)).toThrowError(
      "No Base64 encoder available in this environment.",
    );
  });

  it("should throw if an undefined byte is encountered (defensive check)", () => {
    // GIVEN
    const bytes = {
      length: 3,
      0: 0x66,
      1: undefined,
      2: 0x6f,
    } as unknown as Uint8Array;

    (globalThis as any).btoa = vi.fn();

    // WHEN / THEN
    expect(() => bufferToBase64String(bytes)).toThrowError(
      "Unexpected undefined byte in array.",
    );
  });
});
