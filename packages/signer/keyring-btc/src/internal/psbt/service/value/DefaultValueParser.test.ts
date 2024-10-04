import { DefaultValueParser } from "./DefaultValueParser";

describe("DefaultValueParser", () => {
  let service: DefaultValueParser;

  beforeEach(() => {
    service = new DefaultValueParser();
  });

  describe("getInt32LE", () => {
    it("Get a signed 32-bit positive integer", () => {
      // GIVEN
      const data = Uint8Array.from([42, 0, 0, 0]);

      // WHEN
      const result = service.getInt32LE(data);

      // THEN
      expect(result.isJust()).toStrictEqual(true);
      expect(result.unsafeCoerce()).toStrictEqual(42);
    });

    it("Get a signed 32-bit negative integer", () => {
      // GIVEN
      const data = Uint8Array.from([214, 255, 255, 255]);

      // WHEN
      const result = service.getInt32LE(data);

      // THEN
      expect(result.isJust()).toStrictEqual(true);
      expect(result.unsafeCoerce()).toStrictEqual(-42);
    });

    it("Invalid data", () => {
      // GIVEN
      const data = Uint8Array.from([0, 0, 0]);

      // WHEN
      const result = service.getInt32LE(data);

      // THEN
      expect(result.isJust()).toStrictEqual(false);
    });
  });

  describe("getVarint", () => {
    it("Get a varint", () => {
      // GIVEN
      const data = Uint8Array.from([0xfe, 0x91, 0x45, 0xdc, 0x00]);

      // WHEN
      const result = service.getVarint(data);

      // THEN
      expect(result.isJust()).toStrictEqual(true);
      expect(result.unsafeCoerce()).toStrictEqual(0xdc4591);
    });

    it("Invalid data", () => {
      // GIVEN
      const data = Uint8Array.from([0xfd, 0x45]);

      // WHEN
      const result = service.getVarint(data);

      // THEN
      expect(result.isJust()).toStrictEqual(false);
    });
  });
});
