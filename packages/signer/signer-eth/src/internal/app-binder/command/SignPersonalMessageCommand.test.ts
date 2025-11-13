import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { SignPersonalMessageCommand } from "./SignPersonalMessageCommand";

const SIGN_PERSONAL_EMPTY_MESSAGE_DATA = new Uint8Array([
  0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0x3c, 0x80, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const SIGN_PERSONAL_EMPTY_MESSAGE_APDU = new Uint8Array([
  0xe0,
  0x08,
  0x00,
  0x00,
  0x19,
  ...SIGN_PERSONAL_EMPTY_MESSAGE_DATA,
]);

const SIGN_PERSONAL_MESSAGE_SHORT_DATA = new Uint8Array([
  0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0x3c, 0x80, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0x42,
  0x54, 0x43, 0x20, 0x74, 0x6f, 0x20, 0x74, 0x68, 0x65, 0x20, 0x6d, 0x6f, 0x6f,
  0x6e,
]);
const SIGN_PERSONAL_MESSAGE_SHORT_APDU = new Uint8Array([
  0xe0,
  0x08,
  0x00,
  0x00,
  0x28,
  ...SIGN_PERSONAL_MESSAGE_SHORT_DATA,
]);

const SIGN_PERSONAL_MESSAGE_NOT_FIRST_CHUNK_DATA = new Uint8Array([
  0x64, 0x75, 0x68, 0x7a, 0x61, 0x75, 0x69, 0x67, 0x64, 0x7a, 0x61, 0x75, 0x69,
  0x67, 0x64, 0x75, 0x7a, 0x61, 0x67, 0x64, 0x69, 0x75, 0x7a, 0x67, 0x61, 0x75,
  0x64, 0x67, 0x7a, 0x61, 0x75, 0x69, 0x67, 0x64, 0x75, 0x7a, 0x69, 0x61, 0x67,
  0x64, 0x75, 0x69, 0x7a, 0x61, 0x67,
]);

const SIGN_PERSONAL_MESSAGE_NOT_FIRST_CHUNK_APDU = new Uint8Array([
  0xe0,
  0x08,
  0x80,
  0x00,
  0x2d,
  ...SIGN_PERSONAL_MESSAGE_NOT_FIRST_CHUNK_DATA,
]);

const SIGN_PERSONAL_MESSAGE_SHORT_SUCCESS_RESPONSE = new Uint8Array([
  0x1b, 0x97, 0xa4, 0xca, 0x8f, 0x69, 0x46, 0x33, 0x59, 0x26, 0x01, 0xf5, 0xa2,
  0x3e, 0x0b, 0xcc, 0x55, 0x3c, 0x9d, 0x0a, 0x90, 0xd3, 0xa3, 0x42, 0x2d, 0x57,
  0x55, 0x08, 0xa9, 0x28, 0x98, 0xb9, 0x6e, 0x69, 0x50, 0xd0, 0x2e, 0x74, 0xe9,
  0xc1, 0x02, 0xc1, 0x64, 0xa2, 0x25, 0x53, 0x30, 0x82, 0xca, 0xbd, 0xd8, 0x90,
  0xef, 0xc4, 0x63, 0xf6, 0x7f, 0x60, 0xce, 0xfe, 0x8c, 0x3f, 0x87, 0xcf, 0xce,
]);

const SIGN_PERSONAL_LONG_MESSAGE_SUCCESS_RESPONSE = new Uint8Array([
  0x1b, 0x19, 0x10, 0x0e, 0x53, 0x38, 0xbc, 0x6c, 0x77, 0x20, 0xbb, 0x47, 0xcf,
  0x39, 0x23, 0x7b, 0x4f, 0x27, 0x31, 0x6c, 0xb2, 0xe4, 0xe2, 0xff, 0x00, 0x46,
  0x18, 0xb7, 0x63, 0xc8, 0x6c, 0x8a, 0x06, 0x0f, 0xf0, 0x1a, 0x85, 0x57, 0x18,
  0xd7, 0x97, 0x5c, 0x1c, 0x54, 0xab, 0xcf, 0x7d, 0x32, 0xff, 0x96, 0x30, 0x7c,
  0x0b, 0xda, 0x8d, 0x69, 0x5d, 0x14, 0x29, 0x0d, 0x4b, 0xc5, 0x4d, 0x27, 0x8b,
]);

describe("SignPersonalMessageCommand", (): void => {
  const defaultArgs = {
    data: new Uint8Array([]),
    isFirstChunk: true,
  };

  describe("name", () => {
    it("should be 'signPersonalMessage'", () => {
      const command = new SignPersonalMessageCommand(defaultArgs);
      expect(command.name).toBe("signPersonalMessage");
    });
  });

  describe("getApdu", () => {
    it("should return correct apdu for an empty message", () => {
      // given
      const command = new SignPersonalMessageCommand({
        data: SIGN_PERSONAL_EMPTY_MESSAGE_DATA,
        isFirstChunk: true,
      });
      // when
      const apdu = command.getApdu();
      // then
      expect(apdu.getRawApdu()).toStrictEqual(SIGN_PERSONAL_EMPTY_MESSAGE_APDU);
    });

    it("should return correct apdu for a short message", () => {
      // given
      const command = new SignPersonalMessageCommand({
        data: SIGN_PERSONAL_MESSAGE_SHORT_DATA,
        isFirstChunk: true,
      });
      // when
      const apdu = command.getApdu();
      // then
      expect(apdu.getRawApdu()).toStrictEqual(SIGN_PERSONAL_MESSAGE_SHORT_APDU);
    });

    it("should return correct apdu for a not first chunk of a long message", () => {
      // given
      const command = new SignPersonalMessageCommand({
        data: SIGN_PERSONAL_MESSAGE_NOT_FIRST_CHUNK_DATA,
        isFirstChunk: false,
      });
      // when
      const apdu = command.getApdu();
      // then
      expect(apdu.getRawApdu()).toStrictEqual(
        SIGN_PERSONAL_MESSAGE_NOT_FIRST_CHUNK_APDU,
      );
    });
  });

  describe("parseResponse", () => {
    it("should return correct response after signing success for a short message", () => {
      // given
      const command = new SignPersonalMessageCommand({
        ...defaultArgs,
      });
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: SIGN_PERSONAL_MESSAGE_SHORT_SUCCESS_RESPONSE,
      });
      // when
      const response = command.parseResponse(apduResponse);
      // then
      expect(response).toStrictEqual(
        CommandResultFactory({
          data: Just({
            r: "0x97a4ca8f694633592601f5a23e0bcc553c9d0a90d3a3422d575508a92898b96e",
            s: "0x6950d02e74e9c102c164a225533082cabdd890efc463f67f60cefe8c3f87cfce",
            v: 27,
          }),
        }),
      );
    });
    it("should return an error if user refused on device", () => {
      const command = new SignPersonalMessageCommand({
        ...defaultArgs,
      });
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x55, 0x15]),
        data: new Uint8Array([]),
      });
      // when
      const response = command.parseResponse(apduResponse);
      // then
      expect(isSuccessCommandResult(response)).toBe(false);
    });

    it("should return nothing if not last index of a long message", () => {
      // given
      const command = new SignPersonalMessageCommand({
        ...defaultArgs,
      });
      // when
      const response = command.parseResponse(
        new ApduResponse({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array([]),
        }),
      );
      // then
      expect(response).toStrictEqual(CommandResultFactory({ data: Nothing }));
    });

    it("should return correct response of a long message", () => {
      // given
      const command = new SignPersonalMessageCommand({
        ...defaultArgs,
      });
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: SIGN_PERSONAL_LONG_MESSAGE_SUCCESS_RESPONSE,
      });
      // when
      const response = command.parseResponse(apduResponse);
      // then
      expect(response).toStrictEqual(
        CommandResultFactory({
          data: Just({
            r: "0x19100e5338bc6c7720bb47cf39237b4f27316cb2e4e2ff004618b763c86c8a06",
            s: "0x0ff01a855718d7975c1c54abcf7d32ff96307c0bda8d695d14290d4bc54d278b",
            v: 27,
          }),
        }),
      );
    });

    it("should return an error if r is missing", () => {
      // given
      const command = new SignPersonalMessageCommand({
        ...defaultArgs,
      });
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: SIGN_PERSONAL_LONG_MESSAGE_SUCCESS_RESPONSE.slice(0, 32),
      });
      // when
      const response = command.parseResponse(apduResponse);
      // then
      expect(response).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("R is missing"),
        }),
      );
    });

    it("should return an error if s is missing", () => {
      // given
      const command = new SignPersonalMessageCommand({
        ...defaultArgs,
      });
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: SIGN_PERSONAL_LONG_MESSAGE_SUCCESS_RESPONSE.slice(0, 64),
      });
      // when
      const result = command.parseResponse(apduResponse);
      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("S is missing"),
        }),
      );
    });
  });
});
