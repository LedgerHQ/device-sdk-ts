import {
  ApduResponse,
  type InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type TronAppCommandError } from "./utils/tronApplicationErrors";
import { SignTransactionHashCommand } from "./SignTransactionHashCommand";

const PATH = "44'/195'/0'/0/0";
// Encoded "44'/195'/0'/0/0": length byte (05) + 5 BE32 path elements.
const PATH_HEX = "058000002c800000c3800000000000000000000000";
// The hw-app-trx signTransactionHash doc vector.
const HASH_HEX =
  "25b18a55f86afb10e7aca38d0073d04c80397c6636069193953fdefaea0b8369";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

const SIGNATURE = fromHex("ab".repeat(65));

describe("SignTransactionHashCommand", () => {
  const command = new SignTransactionHashCommand({
    derivationPath: PATH,
    transactionHash: fromHex(HASH_HEX),
  });

  describe("name", () => {
    it("should be 'SignTransactionHash'", () => {
      expect(command.name).toBe("SignTransactionHash");
    });
  });

  describe("getApdu", () => {
    it("should build the APDU with CLA=0xe0, INS=0x05, P1=0, P2=0 and the path + hash as data", () => {
      // 0x35 = 53 bytes of data: 21-byte encoded path + 32-byte hash.
      expect(toHex(command.getApdu().getRawApdu())).toBe(
        "e005000035" + PATH_HEX + HASH_HEX,
      );
    });
  });

  describe("parseResponse", () => {
    it("should return the 65-byte signature", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.of(0x90, 0x00),
        data: SIGNATURE,
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      expect(isSuccessCommandResult(result) && result.data).toEqual(SIGNATURE);
    });

    it("should return an error when the signature is missing", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.of(0x90, 0x00),
        data: fromHex("ab".repeat(64)),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Signature is missing",
        );
      }
    });

    it("should return a TronAppCommandError on a device error status", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.of(0x69, 0x85),
        data: new Uint8Array(),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      expect(
        !isSuccessCommandResult(result) &&
          (result.error as TronAppCommandError).errorCode,
      ).toBe("6985");
    });
  });
});
