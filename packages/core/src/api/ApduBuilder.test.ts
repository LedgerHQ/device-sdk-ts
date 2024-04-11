import { APDU_MAX_PAYLOAD, ApduBuilder } from "./ApduBuilder";

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
      const status = builder.addByteToData(0x01);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_SINGLE);
    });

    it("should serialize with an 2 byte body", () => {
      const status = builder.addShortToData(0x3302);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_TWO);
    });

    it("should serialize with an 5 byte body from an hexastring", () => {
      const status: boolean = builder.addHexaStringToData("0x8081828384");
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_HEXA1);
    });

    it("should serialize with an 4 byte body from an hexastring without '0x'", () => {
      const status: boolean = builder.addHexaStringToData("85868788");
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_HEXA2);
    });

    it("should serialize with an 4 byte body LV encoded from an hexastring", () => {
      const status: boolean = builder.encodeInLVFromHexa("0xA1A2A3");
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_LV_HEXA);
    });

    it("should serialize with an 4 byte body LV encoded from an ascci string", () => {
      const status: boolean = builder.encodeInLVFromAscii("maman");
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_LV_ASCII);
    });

    it("should serialize with an 4 byte body LV encoded from a buffer", () => {
      const myarray = new Uint8Array([0xf0, 0xf1]);
      const status: boolean = builder.encodeInLVFromBuffer(myarray);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_LV_ARRAY);
    });

    it("should serialize with an 4 byte body LV encoded from a buffer", () => {
      const myarray = new Uint8Array([0xf0, 0xf1]);
      const status: boolean = builder.encodeInLVFromBuffer(myarray);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_LV_ARRAY);
    });

    it("should serialize with an complete body of 0xAA", () => {
      const myarray = new Uint8Array(255).fill(0xaa, 0, 255);
      const status = builder.addBufferToData(myarray);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
    });
  });

  describe("mixed", () => {
    beforeEach(() => {
      builder = new ApduBuilder({ cla: 0xe0, ins: 0x01, p1: 0x00, p2: 0x00 });
    });

    it("should serialize with all previous field", () => {
      let available = APDU_MAX_PAYLOAD;
      let status: boolean = builder.addByteToData(0x01);
      expect(status).toBe(true);
      available--;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      status = builder.addShortToData(0x3302);
      expect(status).toBe(true);
      available -= 2;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      status = builder.addHexaStringToData("0x8081828384");
      expect(status).toBe(true);
      available -= 5;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      status = builder.addHexaStringToData("85868788");
      expect(status).toBe(true);
      available -= 4;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      status = builder.encodeInLVFromHexa("0xA1A2A3");
      expect(status).toBe(true);
      available -= 4;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      status = builder.encodeInLVFromAscii("maman");
      expect(status).toBe(true);
      available -= 6;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      const myarray = new Uint8Array([0xf0, 0xf1]);
      status = builder.encodeInLVFromBuffer(myarray);
      expect(status).toBe(true);
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
      const status: boolean = builder.addByteToData(undefined);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due value greater than 8-bit integer", () => {
      const status: boolean = builder.addByteToData(0x100);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due value greater than 16-bit integer", () => {
      const status: boolean = builder.addShortToData(0x10000);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due to a string not well coded", () => {
      let status = builder.addHexaStringToData(":08081828384");
      expect(status).toBe(false);
      status = builder.addHexaStringToData("081828384");
      expect(status).toBe(false);
      status = builder.addHexaStringToData("80818n8384");
      expect(status).toBe(false);
      status = builder.addHexaStringToData("808182838z");
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due direct overflow", () => {
      const myarray = new Uint8Array(256).fill(0xaa, 0, 256);
      const status: boolean = builder.addBufferToData(myarray);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due to subsequent overflow with one byte", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      let status: boolean = builder.addBufferToData(myarray);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      status = builder.addByteToData(0);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
    });

    it("error due to subsequent overflow with 2 bytes", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      let status: boolean = builder.addBufferToData(myarray);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      status = builder.addShortToData(0);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
    });

    it("error due to subsequent overflow with 1-byte array", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      let status = builder.addBufferToData(myarray);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      const mybuffer = new Uint8Array(1);
      mybuffer[1] = 0xff;

      status = builder.addBufferToData(mybuffer);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
    });

    it("error due to subsequent overflow with 1-char ascii", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      let status: boolean = builder.addBufferToData(myarray);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      const mystring = "a";

      status = builder.addAsciiStringToData(mystring);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
    });

    it("error due to subsequent overflow with 1-char hexastring", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      let status = builder.addBufferToData(myarray);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      let mystring = "0xB4";

      status = builder.addHexaStringToData(mystring);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      mystring = "e1";

      status = builder.addHexaStringToData(mystring);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
    });

    it("error due to empty values", () => {
      const mystring = "";

      let status: boolean = builder.addHexaStringToData(mystring);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);

      status = builder.encodeInLVFromHexa(mystring);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due to subsequent overflow with 1-char LV", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD - 1).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD - 1,
      );
      let status = builder.addBufferToData(myarray);
      expect(status).toBe(true);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_NEARLY);
      expect(builder.getAvailablePayloadLength()).toBe(1);

      let mystring = "n";

      status = builder.encodeInLVFromAscii(mystring);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_NEARLY);
      expect(builder.getAvailablePayloadLength()).toBe(1);

      mystring = "e1";

      status = builder.encodeInLVFromHexa(mystring);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_NEARLY);
      expect(builder.getAvailablePayloadLength()).toBe(1);

      const mybuffer = new Uint8Array(1);
      mybuffer[1] = 0xff;

      status = builder.encodeInLVFromBuffer(mybuffer);
      expect(status).toBe(false);
      expect(builder.build().getRawApdu()).toEqual(COMMAND_BODY_NEARLY);
      expect(builder.getAvailablePayloadLength()).toBe(1);
    });
  });
});
