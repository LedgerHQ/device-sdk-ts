import {
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAppConfiguration } from "./GetAppConfigurationCommand";

describe("GetConfigCommand", () => {
  let command: GetAppConfiguration;

  beforeEach(() => {
    command = new GetAppConfiguration();
  });

  describe("name", () => {
    it("should be 'getAppConfiguration'", () => {
      expect(command.name).toBe("getAppConfiguration");
    });
  });

  describe("getApdu", () => {
    it("should return the raw APDU", () => {
      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x06, 0x00, 0x00, 0x00]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return the app configuration", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x31, 0x01, 0x02, 0x03]),
      };

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual({
          blindSigningEnabled: true,
          web3ChecksEnabled: true,
          web3ChecksOptIn: true,
          version: "1.2.3",
        });
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should return the app configuration with flags disabled", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
      };

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual({
          blindSigningEnabled: false,
          web3ChecksEnabled: false,
          web3ChecksOptIn: false,
          version: "1.2.3",
        });
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should return an error if the device is locked", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x55, 0x15]),
        data: new Uint8Array(),
      };

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

    it("should return an error if data is invalid", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: new Uint8Array(),
      };

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        expect(result.error).toEqual(
          expect.objectContaining({
            errorCode: "6a80",
            message: "Invalid data",
          }),
        );
      }
    });

    it("should return an error if no flags are extracted", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      };

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect(result.error).toEqual(
          expect.objectContaining({
            originalError: new Error("Cannot extract config flags"),
          }),
        );
      }
    });

    it("should return an error if no version is extracted", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x01]),
      };

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect(result.error).toEqual(
          expect.objectContaining({
            originalError: new Error("Cannot extract version"),
          }),
        );
      }
    });
  });
});
