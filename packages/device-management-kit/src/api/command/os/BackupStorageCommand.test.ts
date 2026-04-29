import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import { BackupStorageCommand } from "@api/command/os/BackupStorageCommand";
import { ApduResponse } from "@api/device-session/ApduResponse";

describe("BackupStorageCommand", () => {
  describe("Name", () => {
    it("name should be 'BackupStorage'", () => {
      // ARRANGE
      const command = new BackupStorageCommand();

      // ACT
      const name = command.name;

      // ASSERT
      expect(name).toBe("BackupStorage");
    });
  });

  describe("Command", () => {
    it("should return the correct APDU for backing up app storage", () => {
      // ARRANGE
      const expectedApdu = Uint8Array.from([0xe0, 0x6b, 0x00, 0x00, 0x00]);

      // ACT
      const apdu = new BackupStorageCommand().getApdu();

      // ASSERT
      expect(apdu.getRawApdu()).toEqual(expectedApdu);
    });
  });

  describe("Success response", () => {
    it("should return the app storage data chunk as a hex string", () => {
      // ARRANGE
      const statusCode = Uint8Array.from([0x90, 0x00]);
      const response = new ApduResponse({
        statusCode,
        data: Uint8Array.from([0xab, 0xcd, 0xef, 0x01, 0x23]),
      });

      // ACT
      const result = new BackupStorageCommand().parseResponse(response);

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      expect(result).toEqual({
        data: {
          chunkData: Uint8Array.from([0xab, 0xcd, 0xef, 0x01, 0x23]),
          chunkSize: 5,
        },
        status: "SUCCESS",
      });
    });
  });

  describe("Error response", () => {
    it.each([
      {
        description: "get info was not called first",
        statusCode: [0x51, 0x23],
        expectedMessage: "Invalid context. Get info must be called.",
      },
      {
        description: "AES key generation fails",
        statusCode: [0x54, 0x19],
        expectedMessage: "Failed to generate AES key.",
      },
      {
        description: "crypto operation fails",
        statusCode: [0x54, 0x1a],
        expectedMessage: "Internal error, crypto operation failed.",
      },
      {
        description: "AES CMAC computation fails",
        statusCode: [0x54, 0x1b],
        expectedMessage: "Internal error, failed to compute AES CMAC.",
      },
      {
        description: "encryption of backup fails",
        statusCode: [0x54, 0x1c],
        expectedMessage: "Failed to encrypt the app storage backup.",
      },
      {
        description: "device is in recovery mode",
        statusCode: [0x62, 0x2f],
        expectedMessage: "Invalid device state, recovery mode.",
      },
      {
        description: "backup was already performed",
        statusCode: [0x66, 0x42],
        expectedMessage: "Invalid backup state, backup already performed.",
      },
      {
        description:
          "error code is not specific to BackupStorageCommand (global error)",
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
        const result = new BackupStorageCommand().parseResponse(response);

        // ASSERT
        expect(isSuccessCommandResult(result)).toBe(false);
        expect((result as unknown as { error: Error }).error.message).toBe(
          expectedMessage,
        );
      },
    );
  });
});
