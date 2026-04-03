import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignTransferWithMemoCommand } from "@internal/app-binder/command/SignTransferWithMemoCommand";
import {
  type ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";

describe("SignTransferWithMemoCommand", () => {
  describe("getApdu", () => {
    it("should build APDU with INS=SIGN_TRANSFER_WITH_MEMO and given P1", () => {
      const command = new SignTransferWithMemoCommand({
        p1: P1.INITIAL_WITH_MEMO,
        data: new Uint8Array(50).fill(0x01),
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[0]).toBe(LEDGER_CLA);
      expect(raw[1]).toBe(INS.SIGN_TRANSFER_WITH_MEMO);
      expect(raw[2]).toBe(P1.INITIAL_WITH_MEMO);
      expect(raw[3]).toBe(P2.NONE);
    });

    it("should use P1=MEMO for memo chunks", () => {
      const command = new SignTransferWithMemoCommand({
        p1: P1.MEMO,
        data: new Uint8Array(100).fill(0xcc),
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[2]).toBe(P1.MEMO);
    });

    it("should use P1=AMOUNT for final amount step", () => {
      const command = new SignTransferWithMemoCommand({
        p1: P1.AMOUNT,
        data: new Uint8Array(8).fill(0x00),
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[2]).toBe(P1.AMOUNT);
    });

    it("should include data in APDU payload", () => {
      const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const command = new SignTransferWithMemoCommand({
        p1: P1.MEMO,
        data,
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw.slice(5)).toStrictEqual(data);
    });
  });

  describe("parseResponse", () => {
    it("should extract signature bytes on success", () => {
      const command = new SignTransferWithMemoCommand({
        p1: P1.AMOUNT,
        data: new Uint8Array(8),
      });

      const signature = new Uint8Array(64).fill(0xab);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: signature,
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual(signature);
      }
    });

    it("should return empty data for intermediate step response", () => {
      const command = new SignTransferWithMemoCommand({
        p1: P1.INITIAL_WITH_MEMO,
        data: new Uint8Array(50),
      });

      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should return ConcordiumAppCommandError on user rejection", () => {
      const command = new SignTransferWithMemoCommand({
        p1: P1.AMOUNT,
        data: new Uint8Array(8),
      });

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

    it("should return ConcordiumAppCommandError on data invalid", () => {
      const command = new SignTransferWithMemoCommand({
        p1: P1.MEMO,
        data: new Uint8Array(10),
      });

      const response = new ApduResponse({
        statusCode: new Uint8Array([0x6a, 0x80]),
        data: new Uint8Array([]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ConcordiumAppCommandError;
        expect(err.errorCode).toBe(ConcordiumErrorCodes.DATA_INVALID);
      }
    });
  });
});
