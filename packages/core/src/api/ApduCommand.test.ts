import { APDU_MAX_PAYLOAD, ApduCommand } from "./ApduCommand";

const COMMAND_NO_BODY = new Uint8Array([0xe0, 0x01, 0x00, 0x00, 0x00]);

const COMMAND_NEW_P1 = new Uint8Array([0xe0, 0x01, 0xa5, 0x00, 0x00]);

const COMMAND_NEW_P1P2 = new Uint8Array([0xe0, 0x01, 0xa5, 0xc3, 0x00]);

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
  0xe0, 0x01, 0x00, 0x00, 0xff, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
]);

const COMMAND_BODY_NEARLY = new Uint8Array([
  0xe0, 0x01, 0x00, 0x00, 0xfe, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
  0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
]);

let apdu: ApduCommand;

describe("ApduCommand", () => {
  describe("clean", () => {
    beforeEach(() => {
      apdu = new ApduCommand({ cla: 0xe0, ins: 0x01, p1: 0x00, p2: 0x00 });
    });

    it("should create an instance", () => {
      expect(apdu).toBeDefined();
      expect(apdu).toBeInstanceOf(ApduCommand);
    });
  });

  describe("simple", () => {
    beforeEach(() => {
      apdu = new ApduCommand({ cla: 0xe0, ins: 0x01, p1: 0x00, p2: 0x00 });
    });

    it("should serialize with an empty body", () => {
      expect(apdu.serialize()).toEqual(COMMAND_NO_BODY);
    });

    it("should serialize with an single byte body", () => {
      const status: boolean = apdu.addByte(0x01).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_SINGLE);
    });

    it("should serialize with an 2 byte body", () => {
      const status: boolean = apdu.addShort(0x3302).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_TWO);
    });

    it("should serialize with an 5 byte body from an hexastring", () => {
      const status: boolean = apdu.addHexaString("0x8081828384").status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_HEXA1);
    });

    it("should serialize with an 4 byte body from an hexastring without '0x'", () => {
      const status: boolean = apdu.addHexaString("85868788").status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_HEXA2);
    });

    it("should serialize with an 4 byte body LV encoded from an hexastring", () => {
      const status: boolean = apdu.encodeInLVFromHexa("0xA1A2A3").status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_LV_HEXA);
    });

    it("should serialize with an 4 byte body LV encoded from an ascci string", () => {
      const status: boolean = apdu.encodeInLVFromAscii("maman").status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_LV_ASCII);
    });

    it("should serialize with an 4 byte body LV encoded from a buffer", () => {
      const myarray = new Uint8Array([0xf0, 0xf1]);
      const status: boolean = apdu.encodeInLVFromBuffer(myarray).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_LV_ARRAY);
    });

    it("should serialize with an 4 byte body LV encoded from a buffer", () => {
      const myarray = new Uint8Array([0xf0, 0xf1]);
      const status: boolean = apdu.encodeInLVFromBuffer(myarray).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_LV_ARRAY);
    });

    it("should serialize with an complete body of 0xAA", () => {
      const myarray = new Uint8Array(255).fill(0xaa, 0, 255);
      const status: boolean = apdu.addBuffer(myarray).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
    });
  });

  describe("mixed", () => {
    beforeEach(() => {
      apdu = new ApduCommand({ cla: 0xe0, ins: 0x01, p1: 0x00, p2: 0x00 });
    });

    it("should serialize with all previous field", () => {
      let available = APDU_MAX_PAYLOAD;
      let status: boolean = apdu.addByte(0x01).status;
      expect(status).toBe(true);
      available--;
      expect(apdu.getAvailablePayloadLength()).toBe(available);

      status = apdu.addShort(0x3302).status;
      expect(status).toBe(true);
      available -= 2;
      expect(apdu.getAvailablePayloadLength()).toBe(available);

      status = apdu.addHexaString("0x8081828384").status;
      expect(status).toBe(true);
      available -= 5;
      expect(apdu.getAvailablePayloadLength()).toBe(available);

      status = apdu.addHexaString("85868788").status;
      expect(status).toBe(true);
      available -= 4;
      expect(apdu.getAvailablePayloadLength()).toBe(available);

      status = apdu.encodeInLVFromHexa("0xA1A2A3").status;
      expect(status).toBe(true);
      available -= 4;
      expect(apdu.getAvailablePayloadLength()).toBe(available);

      status = apdu.encodeInLVFromAscii("maman").status;
      expect(status).toBe(true);
      available -= 6;
      expect(apdu.getAvailablePayloadLength()).toBe(available);

      const myarray = new Uint8Array([0xf0, 0xf1]);
      status = apdu.encodeInLVFromBuffer(myarray).status;
      expect(status).toBe(true);
      available -= 3;
      expect(apdu.getAvailablePayloadLength()).toBe(available);

      expect(apdu.serialize()).toEqual(COMMAND_BODY_COMBINED);
      apdu.clearPayload();
      expect(apdu.serialize()).toEqual(COMMAND_NO_BODY);
      expect(apdu.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);

      apdu.updateP1(0xa5);
      expect(apdu.serialize()).toEqual(COMMAND_NEW_P1);
      expect(apdu.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);

      apdu.updateP2(0xc3);
      expect(apdu.serialize()).toEqual(COMMAND_NEW_P1P2);
      expect(apdu.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });
  });

  describe("error", () => {
    beforeEach(() => {
      apdu = new ApduCommand({ cla: 0xe0, ins: 0x01, p1: 0x00, p2: 0x00 });
    });

    it("error to undefined value", () => {
      const status: boolean = apdu.addByte(undefined).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_NO_BODY);
      expect(apdu.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due value greater than 8-bit integer", () => {
      const status: boolean = apdu.addByte(0x100).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_NO_BODY);
      expect(apdu.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due value greater than 16-bit integer", () => {
      const status: boolean = apdu.addShort(0x10000).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_NO_BODY);
      expect(apdu.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due to a string not well coded", () => {
      let status: boolean = apdu.addHexaString(":08081828384").status;
      expect(status).toBe(false);
      status = apdu.addHexaString("081828384").status;
      expect(status).toBe(false);
      status = apdu.addHexaString("80818n8384").status;
      expect(status).toBe(false);
      status = apdu.addHexaString("808182838z").status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_NO_BODY);
      expect(apdu.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due direct overflow", () => {
      const myarray = new Uint8Array(256).fill(0xaa, 0, 256);
      const status: boolean = apdu.addBuffer(myarray).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_NO_BODY);
      expect(apdu.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due to subsequent overflow with one byte", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      let status: boolean = apdu.addBuffer(myarray).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
      expect(apdu.getAvailablePayloadLength()).toBe(0);

      status = apdu.addByte(0).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
    });

    it("error due to subsequent overflow with 2 bytes", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      let status: boolean = apdu.addBuffer(myarray).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
      expect(apdu.getAvailablePayloadLength()).toBe(0);

      status = apdu.addShort(0).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
      expect(apdu.getAvailablePayloadLength()).toBe(0);
    });

    it("error due to subsequent overflow with 1-byte array", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      let status: boolean = apdu.addBuffer(myarray).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
      expect(apdu.getAvailablePayloadLength()).toBe(0);

      const mybuffer = new Uint8Array(1);
      mybuffer[1] = 0xff;

      status = apdu.addBuffer(mybuffer).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
      expect(apdu.getAvailablePayloadLength()).toBe(0);
    });

    it("error due to subsequent overflow with 1-char ascii", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      let status: boolean = apdu.addBuffer(myarray).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
      expect(apdu.getAvailablePayloadLength()).toBe(0);

      const mystring = "a";

      status = apdu.addAsciiString(mystring).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
      expect(apdu.getAvailablePayloadLength()).toBe(0);
    });

    it("error due to subsequent overflow with 1-char hexastring", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      let status: boolean = apdu.addBuffer(myarray).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
      expect(apdu.getAvailablePayloadLength()).toBe(0);

      let mystring = "0xB4";

      status = apdu.addHexaString(mystring).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
      expect(apdu.getAvailablePayloadLength()).toBe(0);

      mystring = "e1";

      status = apdu.addHexaString(mystring).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_MAX);
      expect(apdu.getAvailablePayloadLength()).toBe(0);
    });

    it("error due to empty values", () => {
      const mystring = "";

      let status: boolean = apdu.addHexaString(mystring).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_NO_BODY);
      expect(apdu.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);

      status = apdu.encodeInLVFromHexa(mystring).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_NO_BODY);
      expect(apdu.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
    });

    it("error due to subsequent overflow with 1-char LV", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD - 1).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD - 1,
      );
      let status: boolean = apdu.addBuffer(myarray).status;
      expect(status).toBe(true);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_NEARLY);
      expect(apdu.getAvailablePayloadLength()).toBe(1);

      let mystring = "n";

      status = apdu.encodeInLVFromAscii(mystring).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_NEARLY);
      expect(apdu.getAvailablePayloadLength()).toBe(1);

      mystring = "e1";

      status = apdu.encodeInLVFromHexa(mystring).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_NEARLY);
      expect(apdu.getAvailablePayloadLength()).toBe(1);

      const mybuffer = new Uint8Array(1);
      mybuffer[1] = 0xff;

      status = apdu.encodeInLVFromBuffer(mybuffer).status;
      expect(status).toBe(false);
      expect(apdu.serialize()).toEqual(COMMAND_BODY_NEARLY);
      expect(apdu.getAvailablePayloadLength()).toBe(1);
    });
  });
});
