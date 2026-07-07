import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import { CommitRestoreAppStorageCommand } from "@api/command/os/CommitRestoreAppStorageCommand";
import { ApduResponse } from "@api/device-session/ApduResponse";

describe("CommitRestoreAppStorageCommand", () => {
  describe("Name", () => {
    it("name should be 'CommitRestoreAppStorage'", () => {
      // ARRANGE
      const command = new CommitRestoreAppStorageCommand();

      // ACT
      const name = command.name;

      // ASSERT
      expect(name).toBe("CommitRestoreAppStorage");
    });
  });

  describe("Command", () => {
    it("should return the correct APDU for committing an app storage restore", () => {
      // ARRANGE
      const expectedApdu = Uint8Array.from([0xe0, 0x6e, 0x00, 0x00, 0x00]);

      // ACT
      const apdu = new CommitRestoreAppStorageCommand().getApdu();

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
      const result = new CommitRestoreAppStorageCommand().parseResponse(
        response,
      );

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
        expectedMessage: "Invalid context, restore init must be called first.",
      },
      {
        description: "crypto operation failed",
        statusCode: [0x54, 0x19],
        expectedMessage: "Internal error, crypto operation failed.",
      },
      {
        description: "backup authenticity verification failed",
        statusCode: [0x54, 0x1b],
        expectedMessage: "Failed to verify backup authenticity.",
      },
      {
        description: "device is in recovery mode",
        statusCode: [0x66, 0x2f],
        expectedMessage: "Invalid device state, recovery mode.",
      },
      {
        description: "restored app storage size is invalid",
        statusCode: [0x67, 0x34],
        expectedMessage: "Invalid size of the restored app storage.",
      },
      {
        description:
          "error code is not specific to CommitRestoreAppStorageCommand (global error)",
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
        const result = new CommitRestoreAppStorageCommand().parseResponse(
          response,
        );

        // ASSERT
        expect(isSuccessCommandResult(result)).toBe(false);
        expect((result as unknown as { error: Error }).error.message).toBe(
          expectedMessage,
        );
      },
    );
  });
});
