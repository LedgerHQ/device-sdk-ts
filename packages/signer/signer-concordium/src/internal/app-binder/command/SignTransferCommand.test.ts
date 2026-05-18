import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignTransferCommand } from "@internal/app-binder/command/SignTransferCommand";
import {
  type ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";

describe("SignTransferCommand", () => {
  describe("getApdu", () => {
    it("should build APDU with caller-provided P2=LAST", () => {
      const command = new SignTransferCommand({
        data: new Uint8Array(50).fill(0x01),
        p2: P2.LAST,
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[0]).toBe(LEDGER_CLA);
      expect(raw[1]).toBe(INS.SIGN_TRANSFER);
      expect(raw[2]).toBe(0x00);
      expect(raw[3]).toBe(P2.LAST);
    });

    it("should build APDU with caller-provided P2=FEE_DISPLAY", () => {
      const command = new SignTransferCommand({
        data: new Uint8Array(50).fill(0x01),
        p2: P2.FEE_DISPLAY,
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[3]).toBe(P2.FEE_DISPLAY);
    });

    it("should include data in APDU payload", () => {
      const buf = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const command = new SignTransferCommand({
        data: buf,
        p2: P2.LAST,
      });

      const raw = command.getApdu().getRawApdu();
      // Data starts at byte 5
      expect(raw.slice(5)).toStrictEqual(buf);
    });
  });

  describe("parseResponse", () => {
    it("should extract signature bytes on success", () => {
      const command = new SignTransferCommand({
        data: new Uint8Array(10),
        p2: P2.LAST,
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

    it("should return ConcordiumAppCommandError on user rejection", () => {
      const command = new SignTransferCommand({
        data: new Uint8Array(10),
        p2: P2.LAST,
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
      const command = new SignTransferCommand({
        data: new Uint8Array(10),
        p2: P2.LAST,
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
