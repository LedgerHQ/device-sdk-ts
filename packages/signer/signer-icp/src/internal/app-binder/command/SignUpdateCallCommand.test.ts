import {
  ApduBuilder,
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { expectStatusWordError } from "@internal/app-binder/command/__test-utils__/expectStatusWordError";
import { pathToBuffer } from "@internal/app-binder/command/__test-utils__/pathToBuffer";
import {
  icpSignUpdateCallApduHeader,
  SignUpdateCallCommand,
} from "@internal/app-binder/command/SignUpdateCallCommand";
import { IcpErrorCodes } from "@internal/app-binder/command/utils/IcpApplicationErrors";
import {
  P1_ADD,
  P1_INIT,
  P1_LAST,
  SignPhase,
} from "@internal/app-binder/constants";

const DERIVATION_PATH = "44'/223'/0'/0/0";

// Last-chunk layout of the app's SIGN_COMBINED response, per crypto_sign_combined:
// DIGEST_REQUEST(32) · SIG_REQUEST r‖s(64) · DIGEST_STATEREAD(32) · SIG_STATEREAD r‖s(64).
// Each field uses a distinct fill so any mis-slice is caught.
const requestHash = new Uint8Array(32).fill(0x11);
const requestR = new Uint8Array(32).fill(0xaa);
const requestS = new Uint8Array(32).fill(0xbb);
const readStateHash = new Uint8Array(32).fill(0x22);
const readStateR = new Uint8Array(32).fill(0xcc);
const readStateS = new Uint8Array(32).fill(0xdd);
const COMBINED_RESPONSE = new Uint8Array([
  ...requestHash,
  ...requestR,
  ...requestS,
  ...readStateHash,
  ...readStateR,
  ...readStateS,
]);

describe("SignUpdateCallCommand", () => {
  describe("name", () => {
    it("should be 'SignUpdateCall'", () => {
      const command = new SignUpdateCallCommand({
        phase: SignPhase.INIT,
        derivationPath: DERIVATION_PATH,
      });
      expect(command.name).toBe("SignUpdateCall");
    });
  });

  describe("getApdu", () => {
    it("should return the derivation-path packet (INS=0x03, P1=INIT, P2=0) when phase is INIT", () => {
      // ARRANGE
      const command = new SignUpdateCallCommand({
        phase: SignPhase.INIT,
        derivationPath: DERIVATION_PATH,
      });
      const expected = new ApduBuilder(icpSignUpdateCallApduHeader(P1_INIT))
        .addBufferToData(pathToBuffer(DERIVATION_PATH))
        .build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
      expect(apdu.getRawApdu()[1]).toBe(0x03);
    });

    it("should return an add packet (P1=ADD) carrying the chunk when phase is ADD", () => {
      // ARRANGE
      const chunk = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const command = new SignUpdateCallCommand({
        phase: SignPhase.ADD,
        transactionChunk: chunk,
      });
      const expected = new ApduBuilder(icpSignUpdateCallApduHeader(P1_ADD))
        .addBufferToData(chunk)
        .build();
      // ACT & ASSERT
      expect(command.getApdu().getRawApdu()).toStrictEqual(
        expected.getRawApdu(),
      );
    });

    it("should return a last packet (P1=LAST) carrying the chunk when phase is LAST", () => {
      // ARRANGE
      const chunk = new Uint8Array([0x01, 0x02, 0x03]);
      const command = new SignUpdateCallCommand({
        phase: SignPhase.LAST,
        transactionChunk: chunk,
      });
      const expected = new ApduBuilder(icpSignUpdateCallApduHeader(P1_LAST))
        .addBufferToData(chunk)
        .build();
      // ACT & ASSERT
      expect(command.getApdu().getRawApdu()).toStrictEqual(
        expected.getRawApdu(),
      );
    });

    it("should throw when phase is INIT and derivationPath is missing", () => {
      const command = new SignUpdateCallCommand({ phase: SignPhase.INIT });
      expect(() => command.getApdu()).toThrow(
        "SignUpdateCallCommand: derivation path is required for 'init' phase.",
      );
    });

    it("should throw when phase is INIT and path does not have 5 elements", () => {
      const command = new SignUpdateCallCommand({
        phase: SignPhase.INIT,
        derivationPath: "44'/223'/0'",
      });
      expect(() => command.getApdu()).toThrow(
        "SignUpdateCallCommand: expected 5 path elements, got 3",
      );
    });

    it("should throw when phase is ADD and transactionChunk is missing", () => {
      const command = new SignUpdateCallCommand({ phase: SignPhase.ADD });
      expect(() => command.getApdu()).toThrow(
        "SignUpdateCallCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    });
  });

  describe("parseResponse", () => {
    it("should split the last-chunk response into request/read-state digests and r‖s signatures", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: COMBINED_RESPONSE,
      });
      const command = new SignUpdateCallCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.extract()).toEqual({
          requestHash: "11".repeat(32),
          requestSignature: { r: "aa".repeat(32), s: "bb".repeat(32) },
          readStateHash: "22".repeat(32),
          readStateSignature: { r: "cc".repeat(32), s: "dd".repeat(32) },
        });
      }
    });

    it("should return Nothing for an empty intermediate-chunk response", () => {
      // ARRANGE — INIT and ADD chunks reply 0x9000 with no data
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(0),
      });
      const command = new SignUpdateCallCommand({
        phase: SignPhase.ADD,
        transactionChunk: new Uint8Array(1),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.isNothing()).toBe(true);
      }
    });

    it("should reject a non-empty response too short to hold both signatures", () => {
      // ARRANGE — 128 bytes: request block present, read-state signature missing
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: COMBINED_RESPONSE.slice(0, 128),
      });
      const command = new SignUpdateCallCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT & ASSERT
      expect(isSuccessCommandResult(command.parseResponse(response))).toBe(
        false,
      );
    });

    it("should reject a response longer than the fixed 192-byte block", () => {
      // ARRANGE — trailing bytes beyond the two signatures signal a malformed reply
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([...COMBINED_RESPONSE, 0x00]),
      });
      const command = new SignUpdateCallCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT & ASSERT
      expect(isSuccessCommandResult(command.parseResponse(response))).toBe(
        false,
      );
    });

    it("should return IcpAppCommandError when status word signals an error", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x84]),
        data: new Uint8Array(0),
      });
      const command = new SignUpdateCallCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT & ASSERT
      expectStatusWordError(
        command.parseResponse(response),
        IcpErrorCodes.DATA_INVALID,
      );
    });

    it("should map a user-refusal status word (0x6986) to a typed error", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x86]),
        data: new Uint8Array(0),
      });
      const command = new SignUpdateCallCommand({
        phase: SignPhase.LAST,
        transactionChunk: new Uint8Array(1),
      });
      // ACT & ASSERT
      expectStatusWordError(
        command.parseResponse(response),
        IcpErrorCodes.COMMAND_NOT_ALLOWED,
      );
    });
  });
});
