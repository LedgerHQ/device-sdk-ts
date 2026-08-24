import {
  ApduResponse,
  InvalidResponseFormatError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";
import {
  INS,
  P1_DEFAULT,
  P2_DEFAULT,
  XRP_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import { type XrpAppCommandError } from "@internal/app-binder/command/utils/xrpApplicationErrors";

// CLA INS P1 P2 Lc (no data)
const GET_APP_CONFIG_APDU = Uint8Array.from([
  XRP_CLA,
  INS.GET_APP_CONFIGURATION,
  P1_DEFAULT,
  P2_DEFAULT,
  0x00,
]);

// XRP app response: [flags (RFU), major, minor, patch]
const buildConfigResponse = (
  flags: number,
  major: number,
  minor: number,
  patch: number,
) =>
  new ApduResponse({
    statusCode: Uint8Array.from([0x90, 0x00]),
    data: Uint8Array.from([flags, major, minor, patch]),
  });

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
    it("should return the raw APDU", () => {
      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(GET_APP_CONFIG_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should return the app version", () => {
      // GIVEN
      const response = buildConfigResponse(0x00, 1, 2, 3);

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual({ version: "1.2.3" });
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should ignore the RFU flags byte", () => {
      // GIVEN
      const response = buildConfigResponse(0xff, 4, 5, 6);

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual({ version: "4.5.6" });
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should parse a 0.0.0 version", () => {
      // GIVEN
      const response = buildConfigResponse(0x00, 0, 0, 0);

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual({ version: "0.0.0" });
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should return an error if the response is empty", () => {
      // GIVEN
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(0),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        expect(result.error).toBeInstanceOf(InvalidResponseFormatError);
        expect(result.error).toEqual(
          expect.objectContaining({
            originalError: new Error("Cannot extract config flags"),
          }),
        );
      }
    });

    it("should return an error if the version is truncated", () => {
      // GIVEN
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x00, 0x01]),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        expect(result.error).toBeInstanceOf(InvalidResponseFormatError);
        expect(result.error).toEqual(
          expect.objectContaining({
            originalError: new Error("Cannot extract version"),
          }),
        );
      }
    });

    it("should return an XRP app error if the user rejected", () => {
      // GIVEN
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x69, 0x85]),
        data: new Uint8Array(0),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        const error = result.error as XrpAppCommandError;
        expect(error.errorCode).toBe("6985");
        expect(error.message).toBe(
          "Condition of use not satisfied (Rejected by user)",
        );
      }
    });

    it("should return an XRP app error if the instruction is not supported", () => {
      // GIVEN
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6d, 0x00]),
        data: new Uint8Array(0),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        const error = result.error as XrpAppCommandError;
        expect(error.errorCode).toBe("6d00");
        expect(error.message).toBe("Incorrect parameter INS");
      }
    });

    it("should return an error if the device is locked", () => {
      // GIVEN
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x55, 0x15]),
        data: new Uint8Array(0),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        expect(result.error).toEqual(
          expect.objectContaining({
            errorCode: "5515",
            message: "Device is locked.",
          }),
        );
      }
    });
  });
});
