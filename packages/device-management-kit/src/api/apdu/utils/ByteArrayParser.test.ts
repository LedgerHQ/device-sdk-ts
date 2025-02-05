import { hexaStringToBuffer } from "@api/utils/HexaString";

import { ByteArrayParser } from "./ByteArrayParser";

const RESPONSE_ONE_BYTE = new Uint8Array([0x01]);
const RESPONSE_LV_ZERO = new Uint8Array([0x00]);
const RESPONSE_TWO_BYTES = new Uint8Array([0x01, 0x01]);
const RESPONSE_TLV_ZERO = new Uint8Array([0xab, 0x00]);
const RESPONSE_ALL_BYTES = new Uint8Array([
  0x01,
  0x02,
  0x03,
  ...Array<number>(253).fill(0xaa),
]);

/*
Type : 33 00 00 04 -> nanoX
Version SE (LV): 2.2.3
Flag: E600000000
  PIN OK
  Factory init Ok
  Onboarding done
Version MCU(LV): 2.30
Version BootLoader(LV): 1.16
HW rev: 0
Language(LV): Fra & Eng
Recover state (LV): 1
*/
const DEVICE_TYPE = "33000004";
const DEVICE_FLAGS = "0xe6000000";
const NUMERIC_FLAGS = 0xe6000000;
const VERSION_FW_SE = "2.2.3";
const VERSION_FW_MCU = "2.30";
const VERSION_FW_BL = "1.16";
const HARDWARE_REV = 0;
const LANGUAGE_PACK = 1;
const RECOVER_STATE = 0;
const RESPONSE_GET_VERSION = new Uint8Array([
  0x33, 0x00, 0x00, 0x04, 0x05, 0x32, 0x2e, 0x32, 0x2e, 0x33, 0x04, 0xe6, 0x00,
  0x00, 0x00, 0x04, 0x32, 0x2e, 0x33, 0x30, 0x04, 0x31, 0x2e, 0x31, 0x36, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x00,
]);

/*
Format version: 1
Name: BOLOS
Version: 2.2.3
*/
const DASHBOARD_HEX = new Uint8Array([0x42, 0x4f, 0x4c, 0x4f, 0x53]);
const DASHBOARD_NAME = "BOLOS";
const RESPONSE_GET_APP_VERSION = new Uint8Array([
  0x01, 0x05, 0x42, 0x4f, 0x4c, 0x4f, 0x53, 0x05, 0x32, 0x2e, 0x32, 0x2e, 0x33,
]);

let parser: ByteArrayParser;
let response = RESPONSE_ONE_BYTE;

describe("ByteArrayParser", () => {
  const parserExtractNumber = (
    bigEndian: boolean,
    sizeInBits: number,
    signed: boolean,
  ): bigint | number | undefined => {
    if (signed) {
      switch (sizeInBits) {
        case 2:
          return parser.extract16BitInt(bigEndian);
        case 4:
          return parser.extract32BitInt(bigEndian);
        case 8:
          return parser.extract64BitInt(bigEndian);
        case 16:
          return parser.extract128BitInt(bigEndian);
        case 32:
          return parser.extract256BitInt(bigEndian);
      }
    } else {
      switch (sizeInBits) {
        case 2:
          return parser.extract16BitUInt(bigEndian);
        case 4:
          return parser.extract32BitUInt(bigEndian);
        case 8:
          return parser.extract64BitUInt(bigEndian);
        case 16:
          return parser.extract128BitUInt(bigEndian);
        case 32:
          return parser.extract256BitUInt(bigEndian);
      }
    }
    return undefined;
  };

  describe("clean", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should create an instance", () => {
      parser = new ByteArrayParser(response);
      expect(parser).toBeDefined();
      expect(parser).toBeInstanceOf(ByteArrayParser);
    });

    it("Extract a single byte", () => {
      parser = new ByteArrayParser(response);
      expect(parser.extract8BitUInt()).toBe(0x01);
      expect(parser.getCurrentIndex()).toBe(1);
      expect(parser.getUnparsedRemainingLength()).toBe(0);
    });

    it("Extract one byte", () => {
      response = RESPONSE_ALL_BYTES;
      parser = new ByteArrayParser(response);
      let index = 0;
      let length = RESPONSE_ALL_BYTES.length;

      expect(length).toBe(256);
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);
      index++;
      length--;

      expect(parser.extract8BitUInt()).toBe(0x01);
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);
      index++;
      length--;

      expect(parser.extract8BitUInt()).toBe(0x02);
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);
      index++;
      length--;

      expect(parser.extract8BitUInt()).toBe(0x03);
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);
      index++;
      length--;

      while (length != 0) {
        expect(parser.extract8BitUInt()).toBe(0xaa);
        expect(parser.getCurrentIndex()).toBe(index);
        expect(parser.getUnparsedRemainingLength()).toBe(length);
        index++;
        length--;
      }
    });

    it.each([
      [2, false, true, "ffff", 0xffff],
      [2, true, true, "7fff", 0x7fff],
      [2, true, true, "8000", -0x8000],
      [4, false, true, "ffffffff", 0xffffffff],
      [4, true, true, "7fffffff", 0x7fffffff],
      [4, true, true, "80000000", -0x80000000],
      [8, false, true, "ffffffffffffffff", 0xffffffffffffffffn],
      [8, true, true, "7fffffffffffffff", 0x7fffffffffffffffn],
      [8, true, true, "8000000000000000", -0x8000000000000000n],
      [
        16,
        false,
        true,
        "ffffffffffffffffffffffffffffffff",
        0xffffffffffffffffffffffffffffffffn,
      ],
      [
        16,
        true,
        true,
        "7fffffffffffffffffffffffffffffff",
        0x7fffffffffffffffffffffffffffffffn,
      ],
      [
        16,
        true,
        true,
        "80000000000000000000000000000000",
        -0x80000000000000000000000000000000n,
      ],
      [
        32,
        false,
        true,
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
      ],
      [
        32,
        true,
        true,
        "7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
      ],
      [
        32,
        true,
        true,
        "8000000000000000000000000000000000000000000000000000000000000000",
        -0x8000000000000000000000000000000000000000000000000000000000000000n,
      ],
    ])(
      "Extract a number to the limit: size %i, signed %s, bigEndian %s, buffer %s, expected %i",
      (sizeInBits, signed, bigEndian, input, output) => {
        parser = new ByteArrayParser(hexaStringToBuffer(input)!);
        const result = parserExtractNumber(bigEndian, sizeInBits, signed);
        expect(result).toStrictEqual(output);
      },
    );

    it.each([
      [2, false, true, "3302", 0x3302],
      [2, false, false, "0233", 0x3302],
      [2, true, true, "1068", 4200],
      [2, true, true, "ef98", -4200],
      [2, true, false, "6810", 4200],
      [2, true, false, "98ef", -4200],
      [4, false, true, "01234567", 0x01234567],
      [4, false, false, "67452301", 0x01234567],
      [4, true, true, "075bcd15", 123456789],
      [4, true, true, "f8a432eb", -123456789],
      [4, true, false, "15cd5b07", 123456789],
      [4, true, false, "eb32a4f8", -123456789],
      [8, false, true, "0032435442584447", 14147778004927559n],
      [8, false, false, "4744584254433200", 14147778004927559n],
      [8, true, true, "0032435442584447", 14147778004927559n],
      [8, true, true, "ffcdbcabbda7bbb9", -14147778004927559n],
      [8, true, false, "4744584254433200", 14147778004927559n],
      [8, true, false, "b9bba7bdabbccdff", -14147778004927559n],
      [
        16,
        false,
        true,
        "00324354425844470032435442584447",
        0x00324354425844470032435442584447n,
      ],
      [
        16,
        false,
        false,
        "47445842544332004744584254433200",
        0x00324354425844470032435442584447n,
      ],
      [
        16,
        true,
        true,
        "00324354425844470032435442584447",
        0x00324354425844470032435442584447n,
      ],
      [
        16,
        true,
        true,
        "ffcdbcabbda7bbb8ffcdbcabbda7bbb9",
        -0x00324354425844470032435442584447n,
      ],
      [
        16,
        true,
        false,
        "47445842544332004744584254433200",
        0x00324354425844470032435442584447n,
      ],
      [
        16,
        true,
        false,
        "b9bba7bdabbccdffb8bba7bdabbccdff",
        -0x00324354425844470032435442584447n,
      ],
      [
        32,
        false,
        true,
        "0032435442584447003243544258444700324354425844470032435442584447",
        0x0032435442584447003243544258444700324354425844470032435442584447n,
      ],
      [
        32,
        false,
        false,
        "4744584254433200474458425443320047445842544332004744584254433200",
        0x0032435442584447003243544258444700324354425844470032435442584447n,
      ],
      [
        32,
        true,
        true,
        "0032435442584447003243544258444700324354425844470032435442584447",
        0x0032435442584447003243544258444700324354425844470032435442584447n,
      ],
      [
        32,
        true,
        true,
        "ffcdbcabbda7bbb8ffcdbcabbda7bbb8ffcdbcabbda7bbb8ffcdbcabbda7bbb9",
        -0x0032435442584447003243544258444700324354425844470032435442584447n,
      ],
      [
        32,
        true,
        false,
        "4744584254433200474458425443320047445842544332004744584254433200",
        0x0032435442584447003243544258444700324354425844470032435442584447n,
      ],
      [
        32,
        true,
        false,
        "b9bba7bdabbccdffb8bba7bdabbccdffb8bba7bdabbccdffb8bba7bdabbccdff",
        -0x0032435442584447003243544258444700324354425844470032435442584447n,
      ],
    ])(
      "Extract the following number: size %i, signed %s, bigEndian %s, buffer %s, expected %i",
      (sizeInBits, signed, bigEndian, input, output) => {
        parser = new ByteArrayParser(hexaStringToBuffer(input)!);
        const result = parserExtractNumber(bigEndian, sizeInBits, signed);
        expect(result).toStrictEqual(output);
      },
    );

    it("Extract 16-bit & 32-bit number", () => {
      response = RESPONSE_ALL_BYTES;
      parser = new ByteArrayParser(response);
      let index = 0;
      let length = RESPONSE_ALL_BYTES.length;

      expect(length).toBe(256);
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      expect(parser.extract16BitUInt()).toBe(0x0102);
      index += 2;
      length -= 2;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      expect(parser.extract16BitUInt()).toBe(0x03aa);
      index += 2;
      length -= 2;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      parser.resetIndex();
      index = 0;
      length = RESPONSE_ALL_BYTES.length;

      expect(parser.extract32BitUInt()).toBe(0x010203aa);
      index += 4;
      length -= 4;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      expect(parser.extract32BitUInt()).toBe(0xaaaaaaaa);
      index += 4;
      length -= 4;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);
    });

    it("Parse a GetAppVersion response", () => {
      response = RESPONSE_GET_APP_VERSION;
      parser = new ByteArrayParser(response);
      let index = 0;
      let length = RESPONSE_GET_APP_VERSION.length;

      // Parse the response considering the first field to be the format field
      expect(length).toBe(13);

      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      const value = parser.extract8BitUInt();
      index++;
      length--;
      expect(value).toBe(1);
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      let array = parser.extractFieldLVEncoded();
      expect(array).toStrictEqual(DASHBOARD_HEX);
      expect(parser.encodeToString(array)).toBe(DASHBOARD_NAME);
      index += 6;
      length -= 6;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(parser.encodeToString(array)).toBe(VERSION_FW_SE);
      index += 6;
      length -= 6;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      // Reparse the response considering the first field to be the TLV formatted
      parser.resetIndex();
      index = 0;
      length = RESPONSE_GET_APP_VERSION.length;

      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      const field = parser.extractFieldTLVEncoded();
      expect(field?.tag).toBe(0x01);
      expect(field?.value).toStrictEqual(DASHBOARD_HEX);
      expect(parser.encodeToString(field?.value)).toBe(DASHBOARD_NAME);
      index += 7;
      length -= 7;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(parser.encodeToString(array)).toBe(VERSION_FW_SE);
      index += 6;
      length -= 6;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);
    });

    it("Parse a GetVersion response", () => {
      response = RESPONSE_GET_VERSION;
      parser = new ByteArrayParser(response);
      let index = 0;
      let length = RESPONSE_GET_VERSION.length;

      expect(length).toBe(31);
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);
      expect(parser.testMinimalLength(25)).toBe(true);

      let array = parser.extractFieldByLength(4);
      expect(parser.encodeToHexaString(array)).toBe(DEVICE_TYPE);
      index += 4;
      length -= 4;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(parser.encodeToString(array)).toBe(VERSION_FW_SE);
      index += 6;
      length -= 6;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      const flags = parser.encodeToHexaString(array, true);
      expect(flags).toBe(DEVICE_FLAGS);
      expect(parseInt(flags, 16)).toBe(NUMERIC_FLAGS);
      index += 5;
      length -= 5;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(parser.encodeToString(array)).toBe(VERSION_FW_MCU);
      index += 5;
      length -= 5;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(parser.encodeToString(array)).toBe(VERSION_FW_BL);
      index += 5;
      length -= 5;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(array?.at(0)).toBe(HARDWARE_REV);
      index += 2;
      length -= 2;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(array?.at(0)).toBe(LANGUAGE_PACK);
      index += 2;
      length -= 2;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(array?.at(0)).toBe(RECOVER_STATE);
      index += 2;
      length -= 2;
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);
    });
  });

  describe("errors", () => {
    it("no response", () => {
      response = new Uint8Array();
      parser = new ByteArrayParser(response);
      const index = 0;
      const length = 0;

      expect(parser.testMinimalLength(1)).toBe(false);

      expect(parser.extract8BitUInt()).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      expect(parser.extract16BitUInt()).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      expect(parser.extract32BitUInt()).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      let array = parser.extractFieldByLength(2);
      expect(array).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(array).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      const field = parser.extractFieldTLVEncoded();
      expect(field).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);
    });

    it("length error", () => {
      response = RESPONSE_ONE_BYTE;
      parser = new ByteArrayParser(response);
      const index = 0;
      const length = RESPONSE_ONE_BYTE.length;

      expect(length).toBe(1);
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      expect(parser.extract16BitUInt()).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      expect(parser.extract32BitUInt()).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      let array = parser.extractFieldByLength(2);
      expect(array).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(array).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      let field = parser.extractFieldTLVEncoded();
      expect(field).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      response = RESPONSE_TWO_BYTES;
      parser = new ByteArrayParser(response);

      field = parser.extractFieldTLVEncoded();
      expect(field).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(
        RESPONSE_TWO_BYTES.length,
      );
    });

    it("Test zero length", () => {
      response = RESPONSE_LV_ZERO;
      parser = new ByteArrayParser(response);
      const zero = new Uint8Array();

      const index = 0;
      let length = RESPONSE_LV_ZERO.length;

      expect(length).toBe(1);
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      const value = parser.extract8BitUInt();
      expect(value).toBe(0);
      expect(parser.getCurrentIndex()).toBe(1);
      expect(parser.getUnparsedRemainingLength()).toBe(0);

      parser.resetIndex();

      let array = parser.extractFieldByLength(0);
      expect(array).toStrictEqual(zero);
      expect(parser.encodeToString(array)).toBe("");
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      array = parser.extractFieldLVEncoded();
      expect(parser.getCurrentIndex()).toBe(1);
      expect(parser.getUnparsedRemainingLength()).toBe(0);
      expect(array).toStrictEqual(zero);
      expect(parser.encodeToString(array)).toBe("");

      response = RESPONSE_TLV_ZERO;
      parser = new ByteArrayParser(response);
      length = RESPONSE_TLV_ZERO.length;

      expect(length).toBe(2);
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(length);

      const field = parser.extractFieldTLVEncoded();
      expect(field?.tag).toBe(0xab);
      expect(field?.value).toStrictEqual(zero);
      expect(parser.encodeToString(field?.value)).toBe("");
      expect(parser.getCurrentIndex()).toBe(2);
      expect(parser.getUnparsedRemainingLength()).toBe(0);

      expect(parser.encodeToHexaString()).toBe("");
      expect(parser.encodeToString()).toBe("");
    });
  });
});
