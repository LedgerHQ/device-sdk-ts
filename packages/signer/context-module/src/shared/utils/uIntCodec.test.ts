import { Left, Right } from "purify-ts";

import { u8Codec, u16Codec, uIntCodec } from "./uIntCodec";

describe("uIntCodec", () => {
  describe("uIntCodec factory", () => {
    it("builds a codec bounded by the given bit width", () => {
      const u4Codec = uIntCodec(4);
      expect(u4Codec.decode(0)).toEqual(Right(0));
      expect(u4Codec.decode(15)).toEqual(Right(15));
      expect(u4Codec.decode(16)).toEqual(
        Left("Expected a u4 integer (0..=15)"),
      );
    });
  });

  describe("u8Codec", () => {
    it.each([0, 1, 127, 255])("decodes %s as Right", (n) => {
      expect(u8Codec.decode(n)).toEqual(Right(n));
    });

    it.each([
      -1,
      256,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ])("rejects out-of-range / non-integer numbers: %s", (n) => {
      expect(u8Codec.decode(n)).toEqual(
        Left("Expected a u8 integer (0..=255)"),
      );
    });

    it.each(["0", null, undefined, true, {}, []])(
      "rejects non-numeric values: %s",
      (value) => {
        expect(u8Codec.decode(value)).toEqual(
          Left("Expected a u8 integer (0..=255)"),
        );
      },
    );

    it("encodes a number as itself", () => {
      expect(u8Codec.encode(42)).toBe(42);
    });
  });

  describe("u16Codec", () => {
    it.each([0, 1, 255, 256, 1000, 65535])("decodes %s as Right", (n) => {
      expect(u16Codec.decode(n)).toEqual(Right(n));
    });

    it.each([
      -1,
      65536,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ])("rejects out-of-range / non-integer numbers: %s", (n) => {
      expect(u16Codec.decode(n)).toEqual(
        Left("Expected a u16 integer (0..=65535)"),
      );
    });

    it.each(["0", null, undefined, true, {}, []])(
      "rejects non-numeric values: %s",
      (value) => {
        expect(u16Codec.decode(value)).toEqual(
          Left("Expected a u16 integer (0..=65535)"),
        );
      },
    );

    it("encodes a number as itself", () => {
      expect(u16Codec.encode(4242)).toBe(4242);
    });
  });
});
