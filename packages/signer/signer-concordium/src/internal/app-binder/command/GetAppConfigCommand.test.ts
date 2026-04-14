import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  type ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";

import { GetAppConfigCommand } from "./GetAppConfigCommand";

const GET_APP_CONFIG_APDU = new Uint8Array([
  LEDGER_CLA,
  INS.GET_APP_VERSION,
  0x00,
  P2.NONE,
  0x00,
]);

describe("GetAppConfigCommand", () => {
  let command: GetAppConfigCommand;

  beforeEach(() => {
    command = new GetAppConfigCommand();
  });

  describe("name", () => {
    it("should be 'GetAppConfig'", () => {
      expect(command.name).toBe("GetAppConfig");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toEqual(GET_APP_CONFIG_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should parse a valid 3-byte version response", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x05, 0x05, 0x00]),
      });

      const result = command.parseResponse(response);

      expect(result).toStrictEqual(
        CommandResultFactory({ data: { version: "5.5.0" } }),
      );
    });

    it("should handle single-digit version components", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x01, 0x00, 0x03]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.version).toBe("1.0.3");
      }
    });

    it("should handle large version components", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0xff, 0x0a, 0x63]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.version).toBe("255.10.99");
      }
    });

    it("should return InvalidStatusWordError when data is empty", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
    });

    it("should return InvalidStatusWordError when data is too short", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x05, 0x04]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
    });

    it("should return ConcordiumAppCommandError on user rejection (0x6985)", () => {
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

    it("should return ConcordiumAppCommandError on INS not supported (0x6d00)", () => {
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

    it("should return ConcordiumAppCommandError on CLA not supported (0x6e00)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x6e, 0x00]),
        data: new Uint8Array([]),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ConcordiumAppCommandError;
        expect(err.errorCode).toBe(ConcordiumErrorCodes.CLA_NOT_SUPPORTED);
      }
    });
  });
});
