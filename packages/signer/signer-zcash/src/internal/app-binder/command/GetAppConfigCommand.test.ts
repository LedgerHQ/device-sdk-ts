import {
  ApduResponse,
  type InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";
import { ZCASH_CLA } from "@internal/app-binder/command/utils/apduHeaderUtils";
import { type ZcashAppCommandError } from "@internal/app-binder/command/utils/zcashApplicationErrors";

const GET_APP_CONFIG_INS = 0xc4;

// CLA INS P1 P2 Le (no data, Le=0x00)
const GET_APP_CONFIG_APDU = Uint8Array.from([
  ZCASH_CLA,
  GET_APP_CONFIG_INS,
  0x00, // P1
  0x00, // P2
  0x00, // Le
]);

// Zcash app response: [0x38, 0x30, major, minor, patch, sdkMaj, sdkMin, apiLevel]
function buildVersionResponse(
  major: number,
  minor: number,
  patch: number,
): ApduResponse {
  return new ApduResponse({
    statusCode: new Uint8Array([0x90, 0x00]),
    data: new Uint8Array([0x38, 0x30, major, minor, patch, 0x01, 0x00, 0x03]),
  });
}

describe("GetAppConfigCommand", () => {
  describe("name", () => {
    it("should be 'GetAppConfig'", () => {
      const command = new GetAppConfigCommand();
      expect(command.name).toBe("getAppConfig");
    });
  });

  describe("getApdu", () => {
    it("should return correct APDU bytes", () => {
      const command = new GetAppConfigCommand();
      expect(command.getApdu().getRawApdu()).toStrictEqual(GET_APP_CONFIG_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should parse version correctly", () => {
      const command = new GetAppConfigCommand();
      const result = command.parseResponse(buildVersionResponse(1, 0, 5));

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.version).toBe("1.0.5");
      }
    });

    it("should parse version 0.0.0 correctly", () => {
      const command = new GetAppConfigCommand();
      const result = command.parseResponse(buildVersionResponse(0, 0, 0));

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.version).toBe("0.0.0");
      }
    });

    it("should return InvalidStatusWordError when response is too short", () => {
      const command = new GetAppConfigCommand();
      // Only 2 prefix bytes, no version bytes
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x38, 0x30]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Cannot extract version",
        );
      }
    });

    it("should return ZcashAppCommandError for known error status code", () => {
      const command = new GetAppConfigCommand();
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x85]),
        data: new Uint8Array(0),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ZcashAppCommandError;
        expect(err.errorCode).toBe("6985");
      }
    });

    it("should return InvalidStatusWordError when response is empty", () => {
      const command = new GetAppConfigCommand();
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(0),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Cannot extract version",
        );
      }
    });
  });
});
