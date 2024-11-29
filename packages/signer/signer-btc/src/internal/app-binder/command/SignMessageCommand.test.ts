import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just } from "purify-ts";

import { type Signature } from "@api/model/Signature";

import { SignMessageCommand } from "./SignMessageCommand";

const PATH = "44'/0'/0'/0/0";
const MESSAGE = new TextEncoder().encode("Hello Bitcoin!");
const MESSAGE_LENGTH = MESSAGE.length;
const MSG_MERKLE_ROOT = new Uint8Array(32).fill(0xfa);

const getResponse = ({
  omitR = false,
  omitS = false,
}: {
  omitR?: boolean;
  omitS?: boolean;
} = {}) =>
  new Uint8Array([
    ...(omitR ? [] : [0x1b]), // v
    ...(omitR
      ? []
      : [
          0x97, 0xa4, 0xca, 0x8f, 0x69, 0x46, 0x33, 0x59, 0x26, 0x01, 0xf5,
          0xa2, 0x3e, 0x0b, 0xcc, 0x55, 0x3c, 0x9d, 0x0a, 0x90, 0xd3, 0xa3,
          0x42, 0x2d, 0x57, 0x55, 0x08, 0xa9, 0x28, 0x98, 0xb9, 0x6e,
        ]), // r (32 bytes)
    ...(omitS
      ? []
      : [
          0x69, 0x50, 0xd0, 0x2e, 0x74, 0xe9, 0xc1, 0x02, 0xc1, 0x64, 0xa2,
          0x25, 0x53, 0x30, 0x82, 0xca, 0xbd, 0xd8, 0x90, 0xef, 0xc4, 0x63,
          0xf6, 0x7f, 0x60, 0xce, 0xfe, 0x8c, 0x3f, 0x87, 0xcf, 0xce,
        ]), // s (32 bytes)
  ]);

const USER_DENIED_STATUS = new Uint8Array([0x69, 0x85]);

const EXPECTED_APDU = new Uint8Array([
  0xe1, // CLA
  0x10, // INS
  0x00, // P1
  0x01, // P2
  0x36, // Lc
  // Data:
  0x05, // Number of derivation steps (5)
  // BIP32 path:
  // 44' (0x8000002C)
  0x80,
  0x00,
  0x00,
  0x2c,
  // 0' (0x80000000)
  0x80,
  0x00,
  0x00,
  0x00,
  // 0' (0x80000000)
  0x80,
  0x00,
  0x00,
  0x00,
  // 0 (0x00000000)
  0x00,
  0x00,
  0x00,
  0x00,
  // 0 (0x00000000)
  0x00,
  0x00,
  0x00,
  0x00,
  // Message length (varint)
  0x0e, // 14 bytes ("Hello Bitcoin!")
  // messageMerkleRoot
  ...MSG_MERKLE_ROOT,
]);

describe("SignMessageCommand", (): void => {
  const defaultArgs = {
    derivationPath: PATH,
    messageLength: MESSAGE_LENGTH,
    messageMerkleRoot: MSG_MERKLE_ROOT,
  };

  describe("getApdu", () => {
    it("should return correct APDU for given arguments", () => {
      // given
      const command = new SignMessageCommand(defaultArgs);
      // when
      const apdu = command.getApdu();
      // then
      expect(apdu.getRawApdu()).toStrictEqual(EXPECTED_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should return correct response after successful signing", () => {
      // given
      const command = new SignMessageCommand(defaultArgs);
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: getResponse(),
      });
      // when
      const response = command.parseResponse(apduResponse);
      // then
      expect(response).toStrictEqual(
        CommandResultFactory({
          data: Just<Signature>({
            v: 27,
            r: "0x97a4ca8f694633592601f5a23e0bcc553c9d0a90d3a3422d575508a92898b96e",
            s: "0x6950d02e74e9c102c164a225533082cabdd890efc463f67f60cefe8c3f87cfce",
          }),
        }),
      );
    });

    it("should return an error if user denied the operation", () => {
      // given
      const command = new SignMessageCommand(defaultArgs);
      const apduResponse = new ApduResponse({
        statusCode: USER_DENIED_STATUS,
        data: new Uint8Array([]),
      });
      // when
      const response = command.parseResponse(apduResponse);
      // then
      expect(isSuccessCommandResult(response)).toBe(false);
      if (!isSuccessCommandResult(response)) {
        expect(response.error).toBeDefined();
      }
    });

    it("should return an error when the response data is empty", () => {
      // given
      const command = new SignMessageCommand(defaultArgs);
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      });
      // when
      const response = command.parseResponse(apduResponse);
      // then
      expect(isSuccessCommandResult(response)).toBe(false);
      expect(response).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("V is missing"),
        }),
      );
    });

    it("should return correct data when the response data is not empty", () => {
      // given
      const command = new SignMessageCommand(defaultArgs);
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: getResponse(),
      });
      // when
      const response = command.parseResponse(apduResponse);
      // then
      expect(isSuccessCommandResult(response)).toBe(true);
      if (isSuccessCommandResult(response)) {
        expect(response.data.isJust()).toBe(true);
        expect(response.data.extract()).toStrictEqual({
          v: 27,
          r: "0x97a4ca8f694633592601f5a23e0bcc553c9d0a90d3a3422d575508a92898b96e",
          s: "0x6950d02e74e9c102c164a225533082cabdd890efc463f67f60cefe8c3f87cfce",
        });
      }
    });

    it("should return an error if 'r' is missing", () => {
      // given
      const command = new SignMessageCommand(defaultArgs);
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: getResponse({ omitR: true }),
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

    it("should return an error if 's' is missing", () => {
      // given
      const command = new SignMessageCommand(defaultArgs);
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: getResponse({ omitS: true }),
      });
      // when
      const response = command.parseResponse(apduResponse);
      // then
      expect(response).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("S is missing"),
        }),
      );
    });
  });
});
