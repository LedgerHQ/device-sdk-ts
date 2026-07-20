import {
  ApduResponse,
  type InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type TronAppCommandError } from "./utils/tronApplicationErrors";
import { GetECDHSecretCommand } from "./GetECDHSecretCommand";

const PATH = "44'/195'/0'/0/0";
// Encoded "44'/195'/0'/0/0": length byte (05) + 5 BE32 path elements.
const PATH_HEX = "058000002c800000c3800000000000000000000000";
// The hw-app-trx getECDHPairKey doc vector: uncompressed secp256k1 pubkey.
const PUBKEY_HEX =
  "04ff21f8e64d3a3c0198edfbb7afdc79be959432e92e2f8a1984bb436a414b8edcec0345aad0c1bf7da04fd036dd7f9f617e30669224283d950fab9dd84831dc83";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

// The ECDH shared point (0x04 || X || Y), 65 bytes.
const SECRET = fromHex("04" + "cd".repeat(64));

describe("GetECDHSecretCommand", () => {
  const command = new GetECDHSecretCommand({
    derivationPath: PATH,
    publicKey: fromHex(PUBKEY_HEX),
  });

  describe("name", () => {
    it("should be 'GetECDHSecret'", () => {
      expect(command.name).toBe("GetECDHSecret");
    });
  });

  describe("getApdu", () => {
    it("should build the APDU with CLA=0xe0, INS=0x0a, P1=0, P2=1 and the path + peer pubkey as data", () => {
      // 0x56 = 86 bytes of data: 21-byte encoded path + 65-byte pubkey.
      expect(toHex(command.getApdu().getRawApdu())).toBe(
        "e00a000156" + PATH_HEX + PUBKEY_HEX,
      );
    });
  });

  describe("parseResponse", () => {
    it("should return the 65-byte shared secret", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.of(0x90, 0x00),
        data: SECRET,
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      expect(isSuccessCommandResult(result) && result.data).toEqual(SECRET);
    });

    it("should return an error when the shared secret is missing", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.of(0x90, 0x00),
        data: fromHex("04" + "cd".repeat(63)),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "ECDH shared secret is missing",
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
