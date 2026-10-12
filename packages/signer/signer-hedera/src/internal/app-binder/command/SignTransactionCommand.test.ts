import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";

const TRANSACTION_BODY = Uint8Array.from([0x0a, 0x0b, 0x0c]);
const SIGNATURE = Array.from({ length: 64 }, (_, i) => i);

const makeResponse = (data: number[], statusCode = [0x90, 0x00]) =>
  new ApduResponse({
    statusCode: Uint8Array.from(statusCode),
    data: Uint8Array.from(data),
  });

describe("SignTransactionCommand", () => {
  const command = new SignTransactionCommand({
    keyIndex: 0,
    transactionBody: TRANSACTION_BODY,
  });

  describe("name", () => {
    it("should be 'SignTransaction'", () => {
      expect(command.name).toBe("SignTransaction");
    });
  });

  describe("getApdu", () => {
    it("should prefix the transaction body with the little-endian key index", () => {
      expect(command.getApdu().getRawApdu()).toStrictEqual(
        new Uint8Array([
          0xe0, 0x04, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, 0x00, 0x0a, 0x0b,
          0x0c,
        ]),
      );
    });

    it("should throw rather than send a truncated APDU when the body does not fit", () => {
      const oversized = new SignTransactionCommand({
        keyIndex: 0,
        transactionBody: new Uint8Array(252),
      });

      expect(() => oversized.getApdu()).toThrow("Invalid Hedera APDU");
    });
  });

  describe("parseResponse", () => {
    it("should return the 64-byte signature", () => {
      const result = command.parseResponse(makeResponse(SIGNATURE));

      expect(result).toStrictEqual(
        CommandResultFactory({ data: Uint8Array.from(SIGNATURE) }),
      );
    });

    describe("error handling", () => {
      it("should return an error on a signature of the wrong length", () => {
        const result = command.parseResponse(
          makeResponse(new Array(63).fill(1)),
        );

        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        }
      });

      it("should map a user rejection to a Hedera app error", () => {
        const result = command.parseResponse(makeResponse([], [0x69, 0x85]));

        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toEqual(
            expect.objectContaining({
              _tag: "HederaAppCommandError",
              errorCode: "6985",
              message: "User rejected",
            }),
          );
        }
      });
    });
  });
});
