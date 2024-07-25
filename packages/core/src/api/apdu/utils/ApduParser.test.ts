import { ApduResponse } from "@api/device-session/ApduResponse";

import { ApduParser } from "./ApduParser";

const STATUS_WORD_SUCCESS = new Uint8Array([0x90, 0x00]);
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

let parser: ApduParser;
let response: ApduResponse = new ApduResponse({
  statusCode: STATUS_WORD_SUCCESS,
  data: RESPONSE_ONE_BYTE,
});

describe("ApduParser", () => {
  describe("clean", () => {
    it("should create an instance", () => {
      parser = new ApduParser(response);
      expect(parser).toBeDefined();
      expect(parser).toBeInstanceOf(ApduParser);
    });

    it("Extract a single byte", () => {
      parser = new ApduParser(response);
      expect(parser.extract8BitUInt()).toBe(0x01);
      expect(parser.getCurrentIndex()).toBe(1);
      expect(parser.getUnparsedRemainingLength()).toBe(0);
    });

    it("Extract one byte", () => {
      response = new ApduResponse({
        statusCode: STATUS_WORD_SUCCESS,
        data: RESPONSE_ALL_BYTES,
      });
      parser = new ApduParser(response);
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

    it("Extract 16-bit & 32-bit number", () => {
      response = new ApduResponse({
        statusCode: STATUS_WORD_SUCCESS,
        data: RESPONSE_ALL_BYTES,
      });
      parser = new ApduParser(response);
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
      response = new ApduResponse({
        statusCode: STATUS_WORD_SUCCESS,
        data: RESPONSE_GET_APP_VERSION,
      });
      parser = new ApduParser(response);
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
      response = new ApduResponse({
        statusCode: STATUS_WORD_SUCCESS,
        data: RESPONSE_GET_VERSION,
      });
      parser = new ApduParser(response);
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
      response = new ApduResponse({
        statusCode: STATUS_WORD_SUCCESS,
        data: new Uint8Array(),
      });
      parser = new ApduParser(response);
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
      response = new ApduResponse({
        statusCode: STATUS_WORD_SUCCESS,
        data: RESPONSE_ONE_BYTE,
      });
      parser = new ApduParser(response);
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

      response = new ApduResponse({
        statusCode: STATUS_WORD_SUCCESS,
        data: RESPONSE_TWO_BYTES,
      });
      parser = new ApduParser(response);

      field = parser.extractFieldTLVEncoded();
      expect(field).toBeUndefined();
      expect(parser.getCurrentIndex()).toBe(index);
      expect(parser.getUnparsedRemainingLength()).toBe(
        RESPONSE_TWO_BYTES.length,
      );
    });

    it("Test zero length", () => {
      response = new ApduResponse({
        statusCode: STATUS_WORD_SUCCESS,
        data: RESPONSE_LV_ZERO,
      });
      parser = new ApduParser(response);
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

      response = new ApduResponse({
        statusCode: STATUS_WORD_SUCCESS,
        data: RESPONSE_TLV_ZERO,
      });
      parser = new ApduParser(response);
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
