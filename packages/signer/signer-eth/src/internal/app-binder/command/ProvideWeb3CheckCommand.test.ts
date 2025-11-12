import {
  hexaStringToBuffer,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideWeb3CheckCommand } from "@internal/app-binder/command/ProvideWeb3CheckCommand";

describe("ProvideWeb3CheckCommand", () => {
  describe("name", () => {
    it("should be 'provideWeb3Check'", () => {
      const command = new ProvideWeb3CheckCommand({
        payload: new Uint8Array(),
        isFirstChunk: true,
      });
      expect(command.name).toBe("provideWeb3Check");
    });
  });

  describe("getApdu", () => {
    it("should return the raw APDU", () => {
      // GIVEN
      const args = {
        payload: hexaStringToBuffer("0x010203")!,
        isFirstChunk: true,
      };
      const command = new ProvideWeb3CheckCommand(args);

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x32, 0x00, 0x01, 0x03, 0x01, 0x02, 0x03]),
      );
    });

    it("should return the raw APDU for next chunk", () => {
      // GIVEN
      const args = {
        payload: hexaStringToBuffer("0x010203")!,
        isFirstChunk: false,
      };
      const command = new ProvideWeb3CheckCommand(args);

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x32, 0x00, 0x00, 0x03, 0x01, 0x02, 0x03]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return undefined", () => {
      // GIVEN
      const args = {
        payload: hexaStringToBuffer("0x010203")!,
        isFirstChunk: true,
      };
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([]),
      };

      // WHEN
      const result = new ProvideWeb3CheckCommand(args).parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toBeUndefined();
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should return an error if the device is locked", () => {
      // GIVEN
      const args = {
        payload: hexaStringToBuffer("0x010203")!,
        isFirstChunk: true,
      };
      const response = {
        statusCode: Uint8Array.from([0x55, 0x15]),
        data: new Uint8Array(),
      };

      // WHEN
      const result = new ProvideWeb3CheckCommand(args).parseResponse(response);

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
      const args = {
        payload: hexaStringToBuffer("0x010203")!,
        isFirstChunk: true,
      };
      const response = {
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: new Uint8Array(),
      };

      // WHEN
      const result = new ProvideWeb3CheckCommand(args).parseResponse(response);

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
  });
});
