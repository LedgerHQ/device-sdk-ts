import { ApduResponse } from "@api/device-session/ApduResponse";

import { ApduParser } from "./ApduParser";

const STATUS_WORD_SUCCESS = new Uint8Array([0x90, 0x00]);
const RESPONSE_ONE_BYTE = new Uint8Array([0x01]);
const RESPONSE_LV_ZERO = new Uint8Array([0x00]);
const RESPONSE_ALL_BYTES = new Uint8Array([
  0x01,
  0x02,
  0x03,
  ...Array<number>(253).fill(0xaa),
]);

let parser: ApduParser;
let response: ApduResponse = new ApduResponse({
  statusCode: STATUS_WORD_SUCCESS,
  data: RESPONSE_ONE_BYTE,
});

describe("ApduParser", () => {
  it("should create an instance", () => {
    parser = new ApduParser(response);
    expect(parser).toBeDefined();
    expect(parser).toBeInstanceOf(ApduParser);
  });

  it("Extract a single byte", () => {
    parser = new ApduParser(response);
    expect(parser.extract8BitUInt()).toBe(0x01);
  });

  it("Extract 16-bit & 32-bit number", () => {
    response = new ApduResponse({
      statusCode: STATUS_WORD_SUCCESS,
      data: RESPONSE_ALL_BYTES,
    });
    parser = new ApduParser(response);
    expect(parser.extract16BitUInt()).toBe(0x0102);
    expect(parser.extract16BitUInt()).toBe(0x03aa);
  });

  it("Test zero length", () => {
    response = new ApduResponse({
      statusCode: STATUS_WORD_SUCCESS,
      data: RESPONSE_LV_ZERO,
    });
    parser = new ApduParser(response);
    const value = parser.extract8BitUInt();
    expect(value).toBe(0);
  });
});
