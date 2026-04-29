import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  type ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { VerifyAddressCommand } from "@internal/app-binder/command/VerifyAddressCommand";
import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";

const DERIVATION_PATH = "44'/919'/0'/0'/0'";

describe("VerifyAddressCommand", () => {
  describe("getApdu", () => {
    it("should build APDU with correct header", () => {
      const command = new VerifyAddressCommand({
        derivationPath: DERIVATION_PATH,
      });
      const raw = command.getApdu().getRawApdu();

      expect(raw[0]).toBe(LEDGER_CLA);
      expect(raw[1]).toBe(INS.VERIFY_ADDRESS);
      expect(raw[2]).toBe(P1.FULL_PATH);
      expect(raw[3]).toBe(P2.NONE);
    });

    it("should include encoded derivation path in data", () => {
      const command = new VerifyAddressCommand({
        derivationPath: DERIVATION_PATH,
      });
      const raw = command.getApdu().getRawApdu();

      // Data starts at byte 5; first byte is path length (5)
      expect(raw[5]).toBe(5);
      // Total data: 1 (length) + 5*4 (path elements) = 21 bytes
      expect(raw.length).toBe(5 + 21);
    });

    it("should use FULL_PATH P1 (0x02)", () => {
      const command = new VerifyAddressCommand({
        derivationPath: DERIVATION_PATH,
      });
      const raw = command.getApdu().getRawApdu();

      expect(raw[2]).toBe(0x02);
    });
  });

  describe("parseResponse", () => {
    it("should return success on 0x9000 (user approved)", () => {
      const command = new VerifyAddressCommand({
        derivationPath: DERIVATION_PATH,
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should return ConcordiumAppCommandError on user rejection", () => {
      const command = new VerifyAddressCommand({
        derivationPath: DERIVATION_PATH,
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

    it("should return ConcordiumAppCommandError on trusted name mismatch", () => {
      const command = new VerifyAddressCommand({
        derivationPath: DERIVATION_PATH,
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x6b, 0x0c]),
        data: new Uint8Array([]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ConcordiumAppCommandError;
        expect(err.errorCode).toBe(ConcordiumErrorCodes.TRUSTED_NAME_MISMATCH);
      }
    });

    it("should return ConcordiumAppCommandError on INS not supported", () => {
      const command = new VerifyAddressCommand({
        derivationPath: DERIVATION_PATH,
      });
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
