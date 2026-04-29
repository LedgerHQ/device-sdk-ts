import {
  ApduResponse,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetPublicKeyCommand } from "@internal/app-binder/command/GetPublicKeyCommand";
import {
  type ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";

const DERIVATION_PATH = "44'/919'/0'/0'/0'";

describe("GetPublicKeyCommand", () => {
  describe("getApdu", () => {
    it("should build APDU with correct header for non-confirm", () => {
      const command = new GetPublicKeyCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[0]).toBe(LEDGER_CLA);
      expect(raw[1]).toBe(INS.GET_PUBLIC_KEY);
      expect(raw[2]).toBe(P1.NON_CONFIRM);
      expect(raw[3]).toBe(P2.NONE);
    });

    it("should build APDU with CONFIRM P1 when checkOnDevice is true", () => {
      const command = new GetPublicKeyCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: true,
        skipOpenApp: false,
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[2]).toBe(P1.CONFIRM);
    });

    it("should include encoded derivation path in data", () => {
      const command = new GetPublicKeyCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      });

      const raw = command.getApdu().getRawApdu();
      // Data starts at byte 5; first byte is path length
      expect(raw[5]).toBe(5);
      // Total data: 1 (length) + 5*4 (path elements) = 21 bytes
      expect(raw.length).toBe(5 + 21);
    });
  });

  describe("parseResponse", () => {
    it("should extract 32-byte public key on success", () => {
      const command = new GetPublicKeyCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      });

      const pubKey = new Uint8Array(32).fill(0xaa);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: pubKey,
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.publicKey).toStrictEqual(pubKey);
      }
    });

    it("should return InvalidStatusWordError when data is too short", () => {
      const command = new GetPublicKeyCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
      });

      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(10),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
    });

    it("should return ConcordiumAppCommandError on user rejection", () => {
      const command = new GetPublicKeyCommand({
        derivationPath: DERIVATION_PATH,
        checkOnDevice: false,
        skipOpenApp: false,
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
  });
});
