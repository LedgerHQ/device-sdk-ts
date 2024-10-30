import { Value } from "@internal/psbt/model/Value";

import { DefaultValueFactory } from "./DefaultValueFactory";

describe("DefaultValueFactory", () => {
  let factory: DefaultValueFactory;

  beforeEach(() => {
    factory = new DefaultValueFactory();
  });

  describe("fromInt32LE", () => {
    it("Add a signed 32-bit positive integer to the builder", () => {
      // GIVEN
      const value = 42;

      // WHEN
      const result = factory.fromInt32LE(value);

      // THEN
      expect(result.isJust()).toStrictEqual(true);
      expect(result.unsafeCoerce()).toEqual(
        new Value(Uint8Array.from([42, 0, 0, 0])),
      );
    });

    it("Add a signed 32-bit negative integer to the builder", () => {
      // GIVEN
      const value = -42;

      // WHEN
      const result = factory.fromInt32LE(value);

      // THEN
      expect(result.isJust()).toStrictEqual(true);
      expect(result.unsafeCoerce()).toEqual(
        new Value(Uint8Array.from([214, 255, 255, 255])),
      );
    });

    it("invalid value", () => {
      // GIVEN
      const value = 2 ** 32;

      // WHEN
      const result = factory.fromInt32LE(value);

      // THEN
      expect(result.isJust()).toStrictEqual(false);
    });
  });

  describe("fromUInt32LE", () => {
    it("Add an unsigned 32-bit integer to the builder", () => {
      // GIVEN
      const value = 42;

      // WHEN
      const result = factory.fromUInt32LE(value);

      // THEN
      expect(result.isJust()).toStrictEqual(true);
      expect(result.unsafeCoerce()).toEqual(
        new Value(Uint8Array.from([42, 0, 0, 0])),
      );
    });

    it("invalid value", () => {
      // GIVEN
      const value = -42;

      // WHEN
      const result = factory.fromUInt32LE(value);

      // THEN
      expect(result.isJust()).toStrictEqual(false);
    });
  });

  describe("fromInt64LE", () => {
    it("Add a signed 64-bit positive integer to the builder", () => {
      // GIVEN
      const value = 42n;

      // WHEN
      const result = factory.fromInt64LE(value);

      // THEN
      expect(result.isJust()).toStrictEqual(true);
      expect(result.unsafeCoerce()).toEqual(
        new Value(Uint8Array.from([42, 0, 0, 0, 0, 0, 0, 0])),
      );
    });

    it("Add a signed 64-bit negative integer to the builder", () => {
      // GIVEN
      const value = -42n;

      // WHEN
      const result = factory.fromInt64LE(value);

      // THEN
      expect(result.isJust()).toStrictEqual(true);
      expect(result.unsafeCoerce()).toEqual(
        new Value(Uint8Array.from([214, 255, 255, 255, 255, 255, 255, 255])),
      );
    });

    it("invalid value", () => {
      // GIVEN
      const value = 2n ** 64n;

      // WHEN
      const result = factory.fromInt64LE(value);

      // THEN
      expect(result.isJust()).toStrictEqual(false);
    });
  });

  describe("fromVarint", () => {
    it("Add a varint to the builder", () => {
      // GIVEN
      const value = 42;

      // WHEN
      const result = factory.fromVarint(value);

      // THEN
      expect(result.isJust()).toStrictEqual(true);
      expect(result.unsafeCoerce()).toEqual(new Value(Uint8Array.from([42])));
    });
  });
});
