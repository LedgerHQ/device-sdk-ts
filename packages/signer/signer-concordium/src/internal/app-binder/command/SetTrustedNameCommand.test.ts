import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SetTrustedNameCommand } from "@internal/app-binder/command/SetTrustedNameCommand";
import {
  type ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";

describe("SetTrustedNameCommand", () => {
  const samplePayload = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);

  describe("getApdu", () => {
    it("should build APDU with correct header", () => {
      const command = new SetTrustedNameCommand({ payload: samplePayload });
      const raw = command.getApdu().getRawApdu();

      expect(raw[0]).toBe(LEDGER_CLA);
      expect(raw[1]).toBe(INS.SET_TRUSTED_NAME);
      expect(raw[2]).toBe(0x00);
      expect(raw[3]).toBe(P2.NONE);
    });

    it("should include payload in data", () => {
      const command = new SetTrustedNameCommand({ payload: samplePayload });
      const raw = command.getApdu().getRawApdu();

      // Header (5 bytes) + payload
      expect(raw.length).toBe(5 + samplePayload.length);
      expect(raw.slice(5)).toStrictEqual(samplePayload);
    });

    it("should handle large payload", () => {
      const largePayload = new Uint8Array(200).fill(0xff);
      const command = new SetTrustedNameCommand({ payload: largePayload });
      const raw = command.getApdu().getRawApdu();

      expect(raw.length).toBe(5 + 200);
    });
  });

  describe("parseResponse", () => {
    it("should return success on 0x9000", () => {
      const command = new SetTrustedNameCommand({ payload: samplePayload });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should return ConcordiumAppCommandError on invalid param", () => {
      const command = new SetTrustedNameCommand({ payload: samplePayload });
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

    it("should return ConcordiumAppCommandError on user rejection", () => {
      const command = new SetTrustedNameCommand({ payload: samplePayload });
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
      const command = new SetTrustedNameCommand({ payload: samplePayload });
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
