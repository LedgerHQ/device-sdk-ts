import {
  ApduBuilder,
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { describe, expect, it } from "vitest";

import {
  P1_ADD,
  P1_INIT,
  P1_LAST,
  polkadotSignTransactionApduHeader,
  SignPhase,
  SignTransactionCommand,
} from "@internal/app-binder/command/SignTransactionCommand";
import {
  PolkadotAppCommandError,
  PolkadotErrorCodes,
} from "@internal/app-binder/command/utils/polkadotApplicationErrors";

const BITTENSOR_PATH = "44'/1005'/0'/0'/0'";

/**
 * Encodes a derivation path to the Polkadot 20-byte LE format.
 * Passthrough — all elements written as-is (hardened flag preserved).
 */
const pathToBuffer = (derivationPath: string): Uint8Array => {
  const paths = DerivationPathUtils.splitPath(derivationPath);
  const view = new DataView(new ArrayBuffer(20));
  for (let i = 0; i < paths.length; i++) {
    view.setUint32(i * 4, paths[i]! >>> 0, true);
  }
  return new Uint8Array(view.buffer);
};

const blobLenToBuffer = (blobLength: number): Uint8Array => {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, blobLength, true);
  return buf;
};

describe("SignTransactionCommand", () => {
  describe("name", () => {
    it("should be 'SignTransaction'", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: BITTENSOR_PATH,
        blobLength: 100,
      });
      // ASSERT
      expect(command.name).toBe("SignTransaction");
    });
  });

  describe("getApdu", () => {
    it("should return INIT packet (P1=0x00) with path and blobLength", () => {
      // ARRANGE
      const blobLength = 150;
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: BITTENSOR_PATH,
        blobLength,
      });
      const expected = new ApduBuilder(
        polkadotSignTransactionApduHeader(P1_INIT),
      )
        .addBufferToData(pathToBuffer(BITTENSOR_PATH))
        .addBufferToData(blobLenToBuffer(blobLength));
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.build().getRawApdu());
    });

    it("should encode blobLength as 2-byte little-endian in INIT packet", () => {
      // ARRANGE — blobLength=300 (0x012C): LE bytes = [0x2C, 0x01]
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: BITTENSOR_PATH,
        blobLength: 300,
      });
      // ACT
      const apdu = command.getApdu();
      const raw = apdu.getRawApdu();
      // header(5) + path(20) + blobLen(2): blobLen at offset 25
      const blobLenOffset = 5 + 20;
      expect(raw[blobLenOffset]).toBe(0x2c); // 300 & 0xFF
      expect(raw[blobLenOffset + 1]).toBe(0x01); // 300 >> 8
    });

    it("should return ADD packet (P1=0x01) with transaction chunk", () => {
      // ARRANGE
      const chunk = new Uint8Array(100).fill(0xab);
      const command = new SignTransactionCommand({
        phase: SignPhase.ADD,
        transactionChunk: chunk,
      });
      const expected = new ApduBuilder(
        polkadotSignTransactionApduHeader(P1_ADD),
      ).addBufferToData(chunk);
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.build().getRawApdu());
    });

    it("should return LAST packet (P1=0x02) with transaction chunk", () => {
      // ARRANGE
      const chunk = new Uint8Array(50).fill(0xcd);
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: chunk,
      });
      const expected = new ApduBuilder(
        polkadotSignTransactionApduHeader(P1_LAST),
      ).addBufferToData(chunk);
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.build().getRawApdu());
    });

    it("should throw when phase is INIT and derivationPath is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        blobLength: 100,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: derivation path and blob length are required for 'init' phase.",
      );
    });

    it("should throw when phase is INIT and blobLength is undefined", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: BITTENSOR_PATH,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: derivation path and blob length are required for 'init' phase.",
      );
    });

    it("should throw when phase is INIT and derivation path does not have 5 elements", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: "44'/1005'/0'",
        blobLength: 100,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: expected 5 path elements, got 3",
      );
    });

    it("should throw when phase is ADD and transactionChunk is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.ADD,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    });

    it("should throw when phase is LAST and transactionChunk is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    });
  });

  describe("parseResponse", () => {
    it("should return raw signature bytes on success (0x9000)", () => {
      // ARRANGE
      const signature = new Uint8Array(65).fill(0xee);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: signature,
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(result).toStrictEqual(CommandResultFactory({ data: signature }));
      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should return PolkadotAppCommandError with DATA_INVALID when status is 0x6984", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x84]),
        data: new Uint8Array(0),
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(PolkadotAppCommandError);
        const err = result.error as PolkadotAppCommandError;
        expect(err.errorCode).toBe(PolkadotErrorCodes.DATA_INVALID);
      }
    });
  });
});
