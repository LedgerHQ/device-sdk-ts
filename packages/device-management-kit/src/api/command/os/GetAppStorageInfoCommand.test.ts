import { InvalidStatusWordError } from "@api/command/Errors";
import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import { GetAppStorageInfoCommand } from "@api/command/os/GetAppStorageInfoCommand";
import { ApduResponse } from "@api/device-session/ApduResponse";

describe("GetAppStorageInfoCommand", () => {
  describe("Name", () => {
    it("name should be 'GetAppStorageInfo'", () => {
      // ARRANGE
      const command = new GetAppStorageInfoCommand({ appName: "MyApp" });

      // ACT
      const name = command.name;

      // ASSERT
      expect(name).toBe("GetAppStorageInfo");
    });
  });

  describe("Command", () => {
    it("should return the correct APDU for getting the app storage info", () => {
      // ARRANGE
      const expectedApdu = Uint8Array.from([
        0xe0, 0x6a, 0x00, 0x00, 0x05, 0x4d, 0x79, 0x41, 0x70, 0x70,
      ]);

      // ACT
      const apdu = new GetAppStorageInfoCommand({ appName: "MyApp" }).getApdu();

      // ASSERT
      expect(apdu.getRawApdu()).toEqual(expectedApdu);
    });
  });

  describe("Success response", () => {
    it("should return correct app storage info when app storage size is not 0", () => {
      // ARRANGE
      const statusCode = Uint8Array.from([0x90, 0x00]);
      const response = new ApduResponse({
        statusCode,
        data: Uint8Array.from([
          // appStorageSize (32-bit BE) = 1
          0x00, 0x00, 0x00, 0x01,
          // appStorageVersion (32-bit BE) = 1
          0x00, 0x00, 0x00, 0x01,
          // appStorageProperties (16-bit BE) = 0x0003 (bits 0 and 1 set)
          0x00, 0x03,
          // appStorageHash (32 bytes)
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
        ]),
      });

      // ACT
      const result = new GetAppStorageInfoCommand({
        appName: "MyApp",
      }).parseResponse(response);

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      expect(result).toEqual({
        data: {
          storageSize: 1,
          storageVersion: "1",
          hasSettings: true,
          hasData: true,
          storageHash:
            "0000000000000000000000000000000000000000000000000000000000000001",
        },
        status: "SUCCESS",
      });
    });

    it("should return correct app storage info when app storage size is 0", () => {
      // ARRANGE
      const statusCode = Uint8Array.from([0x90, 0x00]);
      const response = new ApduResponse({
        statusCode,
        data: Uint8Array.from([
          // appStorageSize (32-bit BE) = 0
          0x00, 0x00, 0x00, 0x00,
        ]),
      });

      // ACT
      const result = new GetAppStorageInfoCommand({
        appName: "MyApp",
      }).parseResponse(response);

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      expect(result).toEqual({
        data: {
          storageSize: 0,
          storageVersion: "",
          hasSettings: false,
          hasData: false,
          storageHash: "",
        },
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
        expectedMessage: "Device is in recovery mode.",
      },
      {
        description: "application name length is invalid",
        statusCode: [0x67, 0x0a],
        expectedMessage: "Invalid application name length, two chars minimum.",
      },
      {
        description:
          "error code is not specific to GetAppStorageInfoCommand (global error)",
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
        const result = new GetAppStorageInfoCommand({
          appName: "MyApp",
        }).parseResponse(response);

        // ASSERT
        expect(isSuccessCommandResult(result)).toBe(false);
        expect((result as unknown as { error: Error }).error.message).toBe(
          expectedMessage,
        );
      },
    );

    it.each([
      {
        description: "app storage size extraction fails",
        data: new Uint8Array([]),
        expectedOriginalMessage: "Failed to extract app storage size",
      },
      {
        description: "app storage version extraction fails",
        data: Uint8Array.from([0x00, 0x00, 0x00, 0x01]),
        expectedOriginalMessage: "Failed to extract app storage version",
      },
      {
        description: "app storage properties extraction fails",
        data: Uint8Array.from([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01]),
        expectedOriginalMessage: "Failed to extract app storage properties",
      },
    ])(
      "should return error when $description",
      ({ data, expectedOriginalMessage }) => {
        // ARRANGE
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data,
        });

        // ACT
        const result = new GetAppStorageInfoCommand({
          appName: "MyApp",
        }).parseResponse(response);

        // ASSERT
        expect(isSuccessCommandResult(result)).toBe(false);
        expect(
          (result as unknown as { error: InvalidStatusWordError }).error,
        ).toBeInstanceOf(InvalidStatusWordError);
        expect(
          (result as unknown as { error: InvalidStatusWordError }).error
            .originalError?.message,
        ).toBe(expectedOriginalMessage);
      },
    );
  });
});
