import { isSuccessCommandResult } from "@ledgerhq/device-management-kit";

import { Web3CheckOptInCommand } from "@internal/app-binder/command/Web3CheckOptInCommand";

describe("Web3CheckOptInCommand", () => {
  describe("getApdu", () => {
    it("should return the raw APDU", () => {
      // GIVEN
      const command = new Web3CheckOptInCommand();

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x32, 0x01, 0x00, 0x00]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return true", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x01]),
      };

      // WHEN
      const result = new Web3CheckOptInCommand().parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({ enabled: true });
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should return false", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x00]),
      };

      // WHEN
      const result = new Web3CheckOptInCommand().parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({ enabled: false });
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should return false if missing", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([]),
      };

      // WHEN
      const result = new Web3CheckOptInCommand().parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({ enabled: false });
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
      const result = new Web3CheckOptInCommand().parseResponse(response);

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
