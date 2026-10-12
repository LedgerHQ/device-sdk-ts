import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetPublicKeyCommand } from "@internal/app-binder/command/GetPublicKeyCommand";

import { HederaAppCommandError } from "./utils/hederaApplicationErrors";

const PUBLIC_KEY = Array.from({ length: 32 }, (_, i) => i);
const PUBLIC_KEY_HEX =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

const makeResponse = (data: number[], statusCode = [0x90, 0x00]) =>
  new ApduResponse({
    statusCode: Uint8Array.from(statusCode),
    data: Uint8Array.from(data),
  });

describe("GetPublicKeyCommand", () => {
  describe("name", () => {
    it("should be 'GetPublicKey'", () => {
      const command = new GetPublicKeyCommand({
        keyIndex: 0,
        checkOnDevice: false,
      });
      expect(command.name).toBe("GetPublicKey");
    });
  });

  describe("getApdu", () => {
    it("should send the key index as 4 little-endian bytes in silent mode", () => {
      const command = new GetPublicKeyCommand({
        keyIndex: 0x01020304,
        checkOnDevice: false,
      });

      expect(command.getApdu().getRawApdu()).toStrictEqual(
        new Uint8Array([0xe0, 0x02, 0x01, 0x00, 0x04, 0x04, 0x03, 0x02, 0x01]),
      );
    });

    it("should ask for on-device confirmation with P1 = 0x00", () => {
      const command = new GetPublicKeyCommand({
        keyIndex: 0,
        checkOnDevice: true,
      });

      expect(command.getApdu().getRawApdu()).toStrictEqual(
        new Uint8Array([0xe0, 0x02, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00]),
      );
    });

    it("should throw on a key index that is not an unsigned 32-bit integer", () => {
      const command = new GetPublicKeyCommand({
        keyIndex: 0x100000000,
        checkOnDevice: false,
      });

      expect(() => command.getApdu()).toThrow("Invalid Hedera key index");
    });
  });

  describe("parseResponse", () => {
    const command = new GetPublicKeyCommand({
      keyIndex: 0,
      checkOnDevice: false,
    });

    it("should return the 32-byte public key as hex", () => {
      const result = command.parseResponse(makeResponse(PUBLIC_KEY));

      expect(result).toStrictEqual(
        CommandResultFactory({ data: PUBLIC_KEY_HEX }),
      );
    });

    describe("error handling", () => {
      it("should return an error when the response is shorter than a public key", () => {
        const result = command.parseResponse(makeResponse([0x01, 0x02, 0x03]));

        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        }
      });

      it("should map a user rejection to a Hedera app error", () => {
        const result = command.parseResponse(makeResponse([], [0x69, 0x85]));

        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toBeInstanceOf(HederaAppCommandError);
          expect(result.error).toEqual(
            expect.objectContaining({ errorCode: "6985" }),
          );
        }
      });

      it("should defer to the global handler for a locked device", () => {
        const result = command.parseResponse(makeResponse([], [0x55, 0x15]));

        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toEqual(
            expect.objectContaining({
              _tag: "DeviceLockedError",
              errorCode: "5515",
            }),
          );
        }
      });
    });
  });
});
