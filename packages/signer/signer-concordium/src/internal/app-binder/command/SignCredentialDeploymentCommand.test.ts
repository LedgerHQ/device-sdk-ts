import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignCredentialDeploymentCommand } from "@internal/app-binder/command/SignCredentialDeploymentCommand";
import {
  type ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";

describe("SignCredentialDeploymentCommand", () => {
  describe("getApdu", () => {
    it("should build APDU with correct INS and given P1/P2", () => {
      const command = new SignCredentialDeploymentCommand({
        p1: P1.FIRST_CHUNK,
        p2: P2.MORE,
        data: new Uint8Array(21),
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[0]).toBe(LEDGER_CLA);
      expect(raw[1]).toBe(INS.SIGN_CREDENTIAL_DEPLOYMENT);
      expect(raw[2]).toBe(P1.FIRST_CHUNK);
      expect(raw[3]).toBe(P2.MORE);
    });

    it("should use P2=LAST for final step", () => {
      const command = new SignCredentialDeploymentCommand({
        p1: P1.NEW_OR_EXISTING,
        p2: P2.LAST,
        data: new Uint8Array(9),
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[2]).toBe(P1.NEW_OR_EXISTING);
      expect(raw[3]).toBe(P2.LAST);
    });

    it("should include data in APDU payload", () => {
      const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const command = new SignCredentialDeploymentCommand({
        p1: P1.PROOFS,
        p2: P2.MORE,
        data,
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw.slice(5)).toStrictEqual(data);
    });
  });

  describe("parseResponse", () => {
    it("should extract signature bytes on success", () => {
      const command = new SignCredentialDeploymentCommand({
        p1: P1.NEW_OR_EXISTING,
        p2: P2.LAST,
        data: new Uint8Array(9),
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

    it("should return empty data for intermediate step", () => {
      const command = new SignCredentialDeploymentCommand({
        p1: P1.VERIFICATION_KEY,
        p2: P2.MORE,
        data: new Uint8Array(34),
      });

      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should return ConcordiumAppCommandError on user rejection", () => {
      const command = new SignCredentialDeploymentCommand({
        p1: P1.NEW_OR_EXISTING,
        p2: P2.LAST,
        data: new Uint8Array(9),
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
