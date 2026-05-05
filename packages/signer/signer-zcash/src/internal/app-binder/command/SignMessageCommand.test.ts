import {
  ApduResponse,
  type InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";
import { type ZcashAppCommandError } from "@internal/app-binder/command/utils/zcashApplicationErrors";

const SIGN_MESSAGE_APDU = Uint8Array.from([
  0xe0, // CLA
  0x4e, // INS (SIGN_MESSAGE)
  0x00, // P1 (first chunk)
  0x00, // P2
  0x1c, // Data length: 1 + 5*4 + 2 + 5
  0x05, // Number of path elements
  0x80,
  0x00,
  0x00,
  0x2c, // 44'
  0x80,
  0x00,
  0x00,
  0x85, // 133'
  0x80,
  0x00,
  0x00,
  0x00, // 0'
  0x00,
  0x00,
  0x00,
  0x00, // 0
  0x00,
  0x00,
  0x00,
  0x00, // 0
  0x00,
  0x05, // Message length
  0x68,
  0x65,
  0x6c,
  0x6c,
  0x6f, // "hello"
]);

const SIGNATURE_DATA = new Uint8Array([
  0x1b, // v
  0x97,
  0xa4,
  0xca,
  0x8f,
  0x69,
  0x46,
  0x33,
  0x59,
  0x26,
  0x01,
  0xf5,
  0xa2,
  0x3e,
  0x0b,
  0xcc,
  0x55,
  0x3c,
  0x9d,
  0x0a,
  0x90,
  0xd3,
  0xa3,
  0x42,
  0x2d,
  0x57,
  0x55,
  0x08,
  0xa9,
  0x28,
  0x98,
  0xb9,
  0x6e, // r (32 bytes)
  0x69,
  0x50,
  0xd0,
  0x2e,
  0x74,
  0xe9,
  0xc1,
  0x02,
  0xc1,
  0x64,
  0xa2,
  0x25,
  0x53,
  0x30,
  0x82,
  0xca,
  0xbd,
  0xd8,
  0x90,
  0xef,
  0xc4,
  0x63,
  0xf6,
  0x7f,
  0x60,
  0xce,
  0xfe,
  0x8c,
  0x3f,
  0x87,
  0xcf,
  0xce, // s (32 bytes)
]);

describe("SignMessageCommand", () => {
  const defaultArgs = {
    derivationPath: "44'/133'/0'/0/0",
    message: "hello",
  };

  describe("name", () => {
    it("should be 'SignMessage'", () => {
      const command = new SignMessageCommand(defaultArgs);
      expect(command.name).toBe("SignMessage");
    });
  });

  describe("getApdu", () => {
    it("should return the expected APDU", () => {
      const command = new SignMessageCommand(defaultArgs);
      const apdu = command.getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(SIGN_MESSAGE_APDU);
    });

    it("should support Uint8Array messages", () => {
      const command = new SignMessageCommand({
        ...defaultArgs,
        message: new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]),
      });
      const apdu = command.getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(SIGN_MESSAGE_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should return signature data on success", () => {
      const command = new SignMessageCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: SIGNATURE_DATA,
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({
          v: 27,
          r: "0x97a4ca8f694633592601f5a23e0bcc553c9d0a90d3a3422d575508a92898b96e",
          s: "0x6950d02e74e9c102c164a225533082cabdd890efc463f67f60cefe8c3f87cfce",
        });
      }
    });

    it("should return ZcashAppCommandError when user denies", () => {
      const command = new SignMessageCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x85]),
        data: new Uint8Array(0),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ZcashAppCommandError;
        expect(err.errorCode).toBe("6985");
      }
    });

    it("should return InvalidStatusWordError when v is missing", () => {
      const command = new SignMessageCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(0),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "V is missing",
        );
      }
    });

    it("should return InvalidStatusWordError when r is missing", () => {
      const command = new SignMessageCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x1b]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "R is missing",
        );
      }
    });

    it("should return InvalidStatusWordError when s is missing", () => {
      const command = new SignMessageCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: SIGNATURE_DATA.slice(0, 33),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "S is missing",
        );
      }
    });
  });
});
