import { APDU_MAX_PAYLOAD, ApduBuilder } from "./ApduBuilder";
import {
  DataOverflowError,
  HexaStringEncodeError,
  InvalidValueError,
  ValueOverflowError,
} from "./AppBuilderError";

const COMMAND_NO_BODY = new Uint8Array([0xe0, 0x01, 0x00, 0x00, 0x00]);

const COMMAND_BODY_SINGLE = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x01, 0x01,
]);

const COMMAND_BODY_TWO = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x02, 0x33, 0x02,
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

const COMMAND_BODY_COMBINED = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0x19, 0x01, 0x33, 0x02, 0x80, 0x81, 0x82, 0x83, 0x84,
  0x85, 0x86, 0x87, 0x88, 0x03, 0xa1, 0xa2, 0xa3, 0x05, 0x6d, 0x61, 0x6d, 0x61,
  0x6e, 0x02, 0xf0, 0xf1,
]);

const COMMAND_BODY_MAX = new Uint8Array([
  0xe0,
  0x01,
  0x00,
  0x00,
  0xff,
  ...Array<number>(255).fill(0xaa),
]);

const COMMAND_BODY_NEARLY = new Uint8Array([
  0xe0,
  0x01,
  0x00,
  0x00,
  0xfe,
  ...Array<number>(254).fill(0xaa),
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
      builder.addByteToData(0x01);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_SINGLE);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 2 byte body", () => {
      builder.addShortToData(0x3302);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_TWO);
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

  describe("mixed", () => {
    beforeEach(() => {
      builder = new ApduBuilder({ cla: 0xe0, ins: 0x01, p1: 0x00, p2: 0x00 });
    });

    it("should serialize with all previous field", () => {
      let available = APDU_MAX_PAYLOAD;
      builder.addByteToData(0x01);
      available--;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.addShortToData(0x3302);
      available -= 2;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.addHexaStringToData("0x8081828384");
      available -= 5;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.addHexaStringToData("85868788");
      available -= 4;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.encodeInLVFromHexa("0xA1A2A3");
      available -= 4;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.encodeInLVFromAscii("maman");
      available -= 6;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      const myarray = new Uint8Array([0xf0, 0xf1]);
      builder.encodeInLVFromBuffer(myarray);
      available -= 3;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_COMBINED);
    });
  });

  describe("error", () => {
    beforeEach(() => {
      builder = new ApduBuilder({ cla: 0xe0, ins: 0x01, p1: 0x00, p2: 0x00 });
    });

    it("error to undefined value", () => {
      builder.addByteToData(undefined);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
      expect(builder.getErrors()).toEqual([new InvalidValueError("byte")]);
    });

    it("error due value greater than 8-bit integer", () => {
      builder.addByteToData(0x100);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
      expect(builder.getErrors()).toEqual([
        new ValueOverflowError((0x100).toString(), 255),
      ]);
    });

    it("error due value greater than 16-bit integer", () => {
      builder.addShortToData(0x10000);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
      expect(builder.getErrors()).toEqual([
        new ValueOverflowError((0x10000).toString(), 65535),
      ]);
    });

    it("error due to a string not well coded", () => {
      builder
        .addHexaStringToData(":08081828384")
        .addHexaStringToData("081828384")
        .addHexaStringToData("80818n8384")
        .addHexaStringToData("808182838z");

      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
      expect(builder.getErrors()).toEqual([
        new HexaStringEncodeError(":08081828384"),
        new HexaStringEncodeError("081828384"),
        new HexaStringEncodeError("80818n8384"),
        new HexaStringEncodeError("808182838z"),
      ]);
    });

    it("error due direct overflow", () => {
      const myarray = new Uint8Array(256).fill(0xaa, 0, 256);
      builder.addBufferToData(myarray);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
      expect(builder.getErrors()).toEqual([
        new DataOverflowError(myarray.toString()),
      ]);
    });

    it("error due to subsequent overflow with one byte", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      builder.addBufferToData(myarray);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      builder.addByteToData(0);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getErrors()).toEqual([new DataOverflowError("0")]);
    });

    it("error due to subsequent overflow with 2 bytes", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      builder.addBufferToData(myarray);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      builder.addShortToData(0);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
      expect(builder.getErrors()).toEqual([new DataOverflowError("0")]);
    });

    it("error due to subsequent overflow with 1-byte array", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      builder.addBufferToData(myarray);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      const mybuffer = new Uint8Array(1);
      mybuffer.set([0xff], 0);

      builder.addBufferToData(mybuffer);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
      expect(builder.getErrors()).toEqual([
        new DataOverflowError(mybuffer.toString()),
      ]);
    });

    it("error due to subsequent overflow with 1-char ascii", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      builder.addBufferToData(myarray);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      const mystring = "a";

      builder.addAsciiStringToData(mystring);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
      expect(builder.getErrors()).toEqual([new DataOverflowError(mystring)]);
    });

    it("error due to subsequent overflow with 1-char hexastring", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      builder.addBufferToData(myarray);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      const firstString = "0xB4";
      const secondString = "e1";

      builder
        .addHexaStringToData(firstString)
        .addHexaStringToData(secondString);

      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
      expect(builder.getErrors()).toEqual([
        new DataOverflowError(builder.getHexaString(firstString).toString()),
        new DataOverflowError(builder.getHexaString(secondString).toString()),
      ]);
    });

    it("error due to empty values", () => {
      const mystring = "";

      builder.addHexaStringToData(mystring).encodeInLVFromHexa(mystring);

      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
      expect(builder.getErrors()).toEqual([
        new HexaStringEncodeError(mystring),
        new HexaStringEncodeError(mystring),
      ]);
    });

    it("error due to subsequent overflow with 1-char LV", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD - 1).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD - 1,
      );
      builder.addBufferToData(myarray);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_NEARLY);
      expect(builder.getAvailablePayloadLength()).toBe(1);

      const firstString = "n";
      const secondString = "e1";
      const mybuffer = new Uint8Array(1);
      mybuffer.set([0xff], 0);

      builder
        .encodeInLVFromAscii(firstString)
        .encodeInLVFromHexa(secondString)
        .encodeInLVFromBuffer(mybuffer);

      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_NEARLY);
      expect(builder.getAvailablePayloadLength()).toBe(1);
      expect(builder.getErrors()).toEqual([
        new DataOverflowError(firstString),
        new DataOverflowError(secondString),
        new DataOverflowError(mybuffer.toString()),
      ]);
    });
  });
});
