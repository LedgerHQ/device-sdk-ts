import {
  ApduResponse,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import {
  type ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";

describe("GetChallengeCommand", () => {
  describe("getApdu", () => {
    it("should build APDU with correct header", () => {
      const command = new GetChallengeCommand();
      const raw = command.getApdu().getRawApdu();

      expect(raw[0]).toBe(LEDGER_CLA);
      expect(raw[1]).toBe(INS.GET_CHALLENGE);
      expect(raw[2]).toBe(0x00);
      expect(raw[3]).toBe(P2.NONE);
    });

    it("should have no data payload", () => {
      const command = new GetChallengeCommand();
      const raw = command.getApdu().getRawApdu();

      expect(raw.length).toBe(5);
      expect(raw[4]).toBe(0x00);
    });
  });

  describe("parseResponse", () => {
    it("should extract 8-byte challenge as hex string on success", () => {
      const command = new GetChallengeCommand();
      const challengeBytes = new Uint8Array([
        0xaa, 0xbb, 0xcc, 0xdd, 0x11, 0x22, 0x33, 0x44,
      ]);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: challengeBytes,
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.challenge).toBe("aabbccdd11223344");
      }
    });

    it("should return InvalidStatusWordError when data is too short", () => {
      const command = new GetChallengeCommand();
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(4),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
    });

    it("should return InvalidStatusWordError when data is empty", () => {
      const command = new GetChallengeCommand();
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(0),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
    });

    it("should return ConcordiumAppCommandError on user rejection", () => {
      const command = new GetChallengeCommand();
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x85]),
        data: new Uint8Array([]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ConcordiumAppCommandError;
        expect(err.errorCode).toBe(ConcordiumErrorCodes.USER_REJECTED);
      }
    });

    it("should return ConcordiumAppCommandError on INS not supported", () => {
      const command = new GetChallengeCommand();
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x6d, 0x00]),
        data: new Uint8Array([]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ConcordiumAppCommandError;
        expect(err.errorCode).toBe(ConcordiumErrorCodes.INS_NOT_SUPPORTED);
      }
    });
  });
});
