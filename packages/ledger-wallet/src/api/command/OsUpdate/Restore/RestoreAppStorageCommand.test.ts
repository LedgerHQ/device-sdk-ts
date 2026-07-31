import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { RestoreAppStorageCommand } from "./RestoreAppStorageCommand";

describe("RestoreAppStorageCommand", () => {
  describe("Name", () => {
    it("name should be 'RestoreAppStorage'", () => {
      // ARRANGE
      const command = new RestoreAppStorageCommand({
        chunkData: Uint8Array.from([0x01, 0x02, 0x03]),
      });

      // ACT
      const name = command.name;

      // ASSERT
      expect(name).toBe("RestoreAppStorage");
    });
  });

  describe("Command", () => {
    it("should return the correct APDU for restoring an app storage chunk", () => {
      // ARRANGE
      const expectedApdu = Uint8Array.from([
        0xe0, 0x6d, 0x00, 0x00, 0x03, 0x01, 0x02, 0x03,
      ]);

      // ACT
      const apdu = new RestoreAppStorageCommand({
        chunkData: Uint8Array.from([0x01, 0x02, 0x03]),
      }).getApdu();

      // ASSERT
      expect(apdu.getRawApdu()).toEqual(expectedApdu);
    });
  });

  describe("Success response", () => {
    it("should return a success result", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([]),
      });

      // ACT
      const result = new RestoreAppStorageCommand({
        chunkData: Uint8Array.from([0x01, 0x02, 0x03]),
      }).parseResponse(response);

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      expect(result).toEqual({
        data: undefined,
        status: "SUCCESS",
      });
    });
  });

  describe("Error response", () => {
    it.each([
      {
        description: "restore init has not been called",
        statusCode: [0x51, 0x23],
        expectedMessage: "Invalid context, Restore Init must be called first.",
      },
      {
        description: "AES key generation failed",
        statusCode: [0x54, 0x19],
        expectedMessage: "Failed to generate AES key.",
      },
      {
        description: "decryption failed",
        statusCode: [0x54, 0x1a],
        expectedMessage: "Failed to decrypt the app storage backup.",
      },
      {
        description: "device is in recovery mode",
        statusCode: [0x66, 0x2f],
        expectedMessage: "Invalid device state, recovery mode.",
      },
      {
        description: "restore has already been performed",
        statusCode: [0x66, 0x43],
        expectedMessage: "Invalid restore state, restore already performed.",
      },
      {
        description: "chunk length is invalid",
        statusCode: [0x67, 0x34],
        expectedMessage: "Invalid chunk length.",
      },
      {
        description: "app storage header is invalid",
        statusCode: [0x68, 0x4a],
        expectedMessage: "Invalid backup, app storage header is not valid.",
      },
      {
        description:
          "error code is not specific to RestoreAppStorageCommand (global error)",
        statusCode: [0x55, 0x15],
        expectedMessage: "Device is locked.",
      },
    ])(
      "should return error when $description",
      ({ statusCode, expectedMessage }) => {
        // ARRANGE
        const response = new ApduResponse({
          statusCode: Uint8Array.from(statusCode),
          data: new Uint8Array([]),
        });

        // ACT
        const result = new RestoreAppStorageCommand({
          chunkData: Uint8Array.from([0x01, 0x02, 0x03]),
        }).parseResponse(response);

        // ASSERT
        expect(isSuccessCommandResult(result)).toBe(false);
        expect((result as unknown as { error: Error }).error.message).toBe(
          expectedMessage,
        );
      },
    );
  });
});
