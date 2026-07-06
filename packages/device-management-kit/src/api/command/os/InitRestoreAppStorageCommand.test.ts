import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import { InitRestoreAppStorageCommand } from "@api/command/os/InitRestoreAppStorageCommand";
import { ApduResponse } from "@api/device-session/ApduResponse";

describe("InitRestoreAppStorageCommand", () => {
  describe("Name", () => {
    it("name should be 'InitRestoreAppStorage'", () => {
      // ARRANGE
      const command = new InitRestoreAppStorageCommand({
        appName: "MyApp",
        backupLength: 10,
      });

      // ACT
      const name = command.name;

      // ASSERT
      expect(name).toBe("InitRestoreAppStorage");
    });
  });

  describe("Command", () => {
    it("should return the correct APDU for initializing an app storage restore", () => {
      // ARRANGE
      const expectedApdu = Uint8Array.from([
        0xe0, 0x6c, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x0a, 0x4d, 0x79, 0x41,
        0x70, 0x70,
      ]);

      // ACT
      const apdu = new InitRestoreAppStorageCommand({
        appName: "MyApp",
        backupLength: 10,
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
      const result = new InitRestoreAppStorageCommand({
        appName: "MyApp",
        backupLength: 10,
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
        description: "application is not found",
        statusCode: [0x51, 0x23],
        expectedMessage: "Application not found.",
      },
      {
        description: "device is in recovery mode",
        statusCode: [0x66, 0x2f],
        expectedMessage: "Invalid device state, recovery mode.",
      },
      {
        description: "user rejected the consent",
        statusCode: [0x55, 0x01],
        expectedMessage: "Invalid consent, user rejected.",
      },
      {
        description: "pin is not set",
        statusCode: [0x55, 0x02],
        expectedMessage: "Invalid consent, pin is not set.",
      },
      {
        description: "application name length is invalid",
        statusCode: [0x67, 0x0a],
        expectedMessage: "Invalid application name length, two chars minimum.",
      },
      {
        description: "backup length value is invalid",
        statusCode: [0x67, 0x33],
        expectedMessage: "Invalid backup length value.",
      },
      {
        description:
          "error code is not specific to InitRestoreAppStorageCommand (global error)",
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
        const result = new InitRestoreAppStorageCommand({
          appName: "MyApp",
          backupLength: 10,
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
