import { APDU_MAX_PAYLOAD, ApduBuilder } from "./ApduBuilder";
import { ValueOverflowError } from "./AppBuilderError";

const COMMAND_NO_BODY = new Uint8Array([0xe0, 0x01, 0x00, 0x00, 0x00]);

const COMMAND_BODY_SINGLE = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x01, 0x01,
]);

const COMMAND_BODY_TWO = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x02, 0x33, 0x02,
]);

const COMMAND_BODY_EIGHT = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x04, 0x01, 0x23, 0x45, 0x67,
]);

const COMMAND_BODY_HEXA1 = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x05, 0x80, 0x81, 0x82, 0x83, 0x84,
]);

const COMMAND_BODY_HEXA2 = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x04, 0x85, 0x86, 0x87, 0x88,
]);

const COMMAND_BODY_LV_HEXA = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x04, 0x03, 0xa1, 0xa2, 0xa3,
]);

const COMMAND_BODY_LV_ASCII = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x06, 0x05, 0x6d, 0x61, 0x6d, 0x61, 0x6e,
]);

const COMMAND_BODY_LV_ARRAY = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x03, 0x02, 0xf0, 0xf1,
]);

const COMMAND_BODY_MAX = new Uint8Array([
  0xe0,
  0x01,
  0x00,
  0x00,
  0xff,
  ...Array<number>(255).fill(0xaa),
]);

let builder: ApduBuilder;

describe("ApduBuilder", () => {
  describe("clean", () => {
    beforeEach(() => {
      builder = new ApduBuilder({ cla: 0xe0, ins: 0x01, p1: 0x00, p2: 0x00 });
    });

    it("should create an instance", () => {
      expect(builder).toBeDefined();
      expect(builder).toBeInstanceOf(ApduBuilder);
    });
  });

  describe("simple", () => {
    beforeEach(() => {
      builder = new ApduBuilder({ cla: 0xe0, ins: 0x01, p1: 0x00, p2: 0x00 });
    });

    it("should serialize with an empty body", () => {
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
    });

    it("should serialize with an single byte body", () => {
      builder.add8BitUIntToData(0x01);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_SINGLE);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 2 byte body", () => {
      builder.add16BitUIntToData(0x3302);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_TWO);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 8 byte body from an hexastring", () => {
      builder.add32BitUIntToData(0x01234567);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_EIGHT);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 5 byte body from an hexastring", () => {
      builder.addHexaStringToData("0x8081828384");
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_HEXA1);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 4 byte body from an hexastring without '0x'", () => {
      builder.addHexaStringToData("85868788");
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_HEXA2);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 4 byte body LV encoded from an hexastring", () => {
      builder.encodeInLVFromHexa("0xA1A2A3");
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_LV_HEXA);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 4 byte body LV encoded from an ascci string", () => {
      builder.encodeInLVFromAscii("maman");
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_LV_ASCII);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 4 byte body LV encoded from a buffer", () => {
      const myarray = new Uint8Array([0xf0, 0xf1]);
      builder.encodeInLVFromBuffer(myarray);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_LV_ARRAY);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 4 byte body LV encoded from a buffer", () => {
      const myarray = new Uint8Array([0xf0, 0xf1]);
      builder.encodeInLVFromBuffer(myarray);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_LV_ARRAY);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an complete body of 0xAA", () => {
      const myarray = new Uint8Array(255).fill(0xaa, 0, 255);
      builder.addBufferToData(myarray);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getErrors()).toEqual([]);
    });
  });

  describe("error", () => {
    beforeEach(() => {
      builder = new ApduBuilder({ cla: 0xe0, ins: 0x01, p1: 0x00, p2: 0x00 });
    });

    it("error due value greater than 8-bit integer", () => {
      builder.add8BitUIntToData(0x100);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
      expect(builder.getErrors()).toEqual([
        new ValueOverflowError((0x100).toString(), 255),
      ]);
    });
  });
});
