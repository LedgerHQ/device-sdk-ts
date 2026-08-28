import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import {
  INS,
  XRP_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import { type XrpAppCommandError } from "@internal/app-binder/command/utils/xrpApplicationErrors";

// A stand-in payload; the command writes whatever chunk it is given.
const CHUNK = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);

// P2 is the curve alone on this instruction — secp256k1, no chain code bit.
const P2 = 0x40;

const buildExpectedApdu = (p1: number) =>
  Uint8Array.from([XRP_CLA, INS.SIGN, p1, P2, CHUNK.length, ...CHUNK]);

// A short DER-encoded ECDSA signature: SEQUENCE { INTEGER, INTEGER }.
const DER_SIGNATURE = [
  0x30,
  0x44,
  0x02,
  0x20,
  ...Array.from({ length: 32 }, (_, i) => (i + 1) & 0xff),
  0x02,
  0x20,
  ...Array.from({ length: 32 }, (_, i) => (i + 33) & 0xff),
];

const success = (data: number[]) =>
  new ApduResponse({
    statusCode: Uint8Array.from([0x90, 0x00]),
    data: Uint8Array.from(data),
  });

describe("SignTransactionCommand", () => {
  describe("name", () => {
    it("should be 'SignTransaction'", () => {
      expect(
        new SignTransactionCommand({
          chunkedData: CHUNK,
          isFirstChunk: true,
          isLastChunk: true,
        }).name,
      ).toBe("SignTransaction");
    });
  });

  describe("getApdu", () => {
    // The app reads P1 as an order bit (clear on the first chunk) and a more
    // bit (set while further chunks follow).
    it.each([
      { isFirstChunk: true, isLastChunk: true, p1: 0x00 },
      { isFirstChunk: true, isLastChunk: false, p1: 0x80 },
      { isFirstChunk: false, isLastChunk: false, p1: 0x81 },
      { isFirstChunk: false, isLastChunk: true, p1: 0x01 },
    ])(
      "should build P1=$p1 when isFirstChunk=$isFirstChunk and isLastChunk=$isLastChunk",
      ({ isFirstChunk, isLastChunk, p1 }) => {
        // GIVEN
        const command = new SignTransactionCommand({
          chunkedData: CHUNK,
          isFirstChunk,
          isLastChunk,
        });

        // WHEN
        const apdu = command.getApdu();

        // THEN
        expect(apdu.getRawApdu()).toStrictEqual(buildExpectedApdu(p1));
      },
    );

    it("should always select secp256k1 in P2", () => {
      // GIVEN
      const command = new SignTransactionCommand({
        chunkedData: CHUNK,
        isFirstChunk: true,
        isLastChunk: true,
      });

      // WHEN
      const apdu = command.getApdu().getRawApdu();

      // THEN
      expect(apdu[3]).toBe(0x40);
    });

    it("should write the chunk as-is, without touching its contents", () => {
      // GIVEN a chunk that already carries an encoded derivation path
      const firstChunk = Uint8Array.from([
        0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0x90, 0x11, 0x22,
      ]);
      const command = new SignTransactionCommand({
        chunkedData: firstChunk,
        isFirstChunk: true,
        isLastChunk: false,
      });

      // WHEN
      const apdu = command.getApdu().getRawApdu();

      // THEN
      expect(apdu.slice(5)).toStrictEqual(firstChunk);
      expect(apdu[4]).toBe(firstChunk.length);
    });
  });

  describe("parseResponse", () => {
    const command = new SignTransactionCommand({
      chunkedData: CHUNK,
      isFirstChunk: true,
      isLastChunk: true,
    });

    it("should return the DER signature from the final chunk", () => {
      // WHEN
      const result = command.parseResponse(success(DER_SIGNATURE));

      // THEN
      if (!isSuccessCommandResult(result)) {
        assert.fail("Expected a success");
      }
      expect(result.data.isJust()).toBe(true);
      // Returned whole: variable length, and the status word is already kept
      // out of the data by ApduResponse.
      expect(result.data.extract()).toStrictEqual(
        Uint8Array.from(DER_SIGNATURE),
      );
    });

    it("should return Nothing when the body is empty", () => {
      // GIVEN the acknowledgement of a non-final chunk
      // WHEN
      const result = command.parseResponse(success([]));

      // THEN
      if (!isSuccessCommandResult(result)) {
        assert.fail("Expected a success");
      }
      expect(result.data.isNothing()).toBe(true);
    });

    it("should map a rejection to an XRP app error", () => {
      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x69, 0x85]),
          data: new Uint8Array(0),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      }
      const error = result.error as XrpAppCommandError;
      expect(error.errorCode).toBe("6985");
      expect(error.message).toBe(
        "Condition of use not satisfied (Rejected by user)",
      );
    });

    it("should map a transaction too large status word", () => {
      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x67, 0x00]),
          data: new Uint8Array(0),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      }
      const error = result.error as XrpAppCommandError;
      expect(error.errorCode).toBe("6700");
      expect(error.message).toBe("Incorrect length, or transaction too large");
    });
  });
});
