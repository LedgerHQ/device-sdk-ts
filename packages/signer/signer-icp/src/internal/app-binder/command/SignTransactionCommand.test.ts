import {
  ApduBuilder,
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { expectStatusWordError } from "@internal/app-binder/command/__test-utils__/expectStatusWordError";
import { pathToBuffer } from "@internal/app-binder/command/__test-utils__/pathToBuffer";
import {
  icpSignTransactionApduHeader,
  P1_ADD,
  P1_INIT,
  P1_LAST,
  SignPhase,
  SignTransactionCommand,
} from "@internal/app-binder/command/SignTransactionCommand";
import { IcpErrorCodes } from "@internal/app-binder/command/utils/IcpApplicationErrors";

const DERIVATION_PATH = "44'/223'/0'/0/0";

describe("SignTransactionCommand", () => {
  describe("name", () => {
    it("should be 'SignTransaction'", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: DERIVATION_PATH,
      });
      // ASSERT
      expect(command.name).toBe("SignTransaction");
    });
  });

  describe("getApdu", () => {
    it("should return the derivation-path packet (P1=INIT, P2=0) when phase is INIT", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: DERIVATION_PATH,
      });
      const expected = new ApduBuilder(icpSignTransactionApduHeader(P1_INIT))
        .addBufferToData(pathToBuffer(DERIVATION_PATH))
        .build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
    });

    it("should return an add packet (P1=ADD) carrying the chunk when phase is ADD", () => {
      // ARRANGE
      const chunk = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const command = new SignTransactionCommand({
        phase: SignPhase.ADD,
        transactionChunk: chunk,
      });
      const expected = new ApduBuilder(icpSignTransactionApduHeader(P1_ADD))
        .addBufferToData(chunk)
        .build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
    });

    it("should return a last packet (P1=LAST) carrying the chunk when phase is LAST", () => {
      // ARRANGE
      const chunk = new Uint8Array([0x01, 0x02, 0x03]);
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: chunk,
      });
      const expected = new ApduBuilder(icpSignTransactionApduHeader(P1_LAST))
        .addBufferToData(chunk)
        .build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
    });

    it("should throw when phase is INIT and derivationPath is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({ phase: SignPhase.INIT });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: derivation path is required for 'init' phase.",
      );
    });

    it("should throw when phase is INIT and path does not have 5 elements", () => {
      // ARRANGE
      const command = new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath: "44'/223'/0'",
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: expected 5 path elements, got 3",
      );
    });

    it("should throw when phase is ADD and transactionChunk is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({ phase: SignPhase.ADD });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    });

    it("should throw when phase is LAST and transactionChunk is missing", () => {
      // ARRANGE
      const command = new SignTransactionCommand({ phase: SignPhase.LAST });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "SignTransactionCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    });
  });

  describe("parseResponse", () => {
    it("should split the last-chunk response into r, s, v and DER signature", () => {
      // ARRANGE
      const r = new Uint8Array(32).fill(0xaa);
      const s = new Uint8Array(32).fill(0xbb);
      const v = new Uint8Array([0x01]);
      const der = new Uint8Array([
        0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01,
      ]);
      const data = new Uint8Array([...r, ...s, ...v, ...der]);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        const signature = result.data.extract();
        expect(signature).toEqual({
          r: "aa".repeat(32),
          s: "bb".repeat(32),
          v: 1,
          der: "3006020101020101",
        });
      }
    });

    it("should return Nothing for an empty intermediate-chunk response", () => {
      // ARRANGE — INIT and ADD chunks reply 0x9000 with no data
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(0),
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.ADD,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT — success, but carries no signature yet (must not abort signing)
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.isNothing()).toBe(true);
      }
    });

    it("should reject a response that carries r, s and v but no DER signature", () => {
      // ARRANGE
      const r = new Uint8Array(32).fill(0xaa);
      const s = new Uint8Array(32).fill(0xbb);
      const v = new Uint8Array([0x01]);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([...r, ...s, ...v]), // 65 bytes, DER missing
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should reject a non-empty response too short to hold r (truncated, not empty)", () => {
      // ARRANGE — 20 bytes: non-empty but fewer than the 32-byte r; must be
      // treated as malformed, not as an empty intermediate reply.
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(20).fill(0xaa),
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should reject a response that has r but truncates before v/DER", () => {
      // ARRANGE — 64 bytes: r and s present, v and DER missing
      const r = new Uint8Array(32).fill(0xaa);
      const s = new Uint8Array(32).fill(0xbb);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([...r, ...s]),
      });
      const command = new SignTransactionCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return IcpAppCommandError when status word signals an error", () => {
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
      expectStatusWordError(result, IcpErrorCodes.DATA_INVALID);
    });
  });
});
