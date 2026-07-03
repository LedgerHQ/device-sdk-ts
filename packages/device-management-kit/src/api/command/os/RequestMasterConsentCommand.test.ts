import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { InvalidArgumentError } from "@api/Error";

import {
  RequestMasterConsentCommand,
  RequestMasterConsentCommandError,
} from "./RequestMasterConsentCommand";

describe("RequestMasterConsentCommand", () => {
  describe("Name", () => {
    it("name should be 'RequestMasterConsent'", () => {
      // ACT
      const command = new RequestMasterConsentCommand({
        languagePackConsentEnabled: true,
        lockScreenPictureConsentEnabled: true,
        appNumber: 1,
        appStorageNumber: 1,
      });

      // ASSERT
      expect(command.name).toBe("RequestMasterConsent");
    });
  });

  describe("Command", () => {
    it("should return the correct APDU for requesting master consent", () => {
      // ARRANGE
      const command = new RequestMasterConsentCommand({
        languagePackConsentEnabled: true,
        lockScreenPictureConsentEnabled: true,
        appNumber: 1,
        appStorageNumber: 1,
      });
      const expectedApdu = Uint8Array.from([
        0xe0, 0x6f, 0x00, 0x00, 0x04, 0x00, 0x00, 0x01, 0x01,
      ]);

      // ACT
      const apdu = command.getApdu();

      // ASSERT
      expect(apdu.getRawApdu()).toEqual(expectedApdu);
    });

    it.each([
      {
        field: "appNumber",
        args: { appNumber: -1, appStorageNumber: 1 },
      },
      {
        field: "appNumber",
        args: { appNumber: 256, appStorageNumber: 1 },
      },
      {
        field: "appNumber",
        args: { appNumber: 1.5, appStorageNumber: 1 },
      },
      {
        field: "appStorageNumber",
        args: { appNumber: 1, appStorageNumber: -1 },
      },
      {
        field: "appStorageNumber",
        args: { appNumber: 1, appStorageNumber: 256 },
      },
      {
        field: "appStorageNumber",
        args: { appNumber: 1, appStorageNumber: 1.5 },
      },
    ])(
      "should throw when $field is not an 8-bit unsigned integer",
      ({ field, args }) => {
        const expectedErrorMessage = `${field} must be an integer between 0 and 255`;

        // ACT
        let caughtError: unknown;
        try {
          new RequestMasterConsentCommand({
            languagePackConsentEnabled: true,
            lockScreenPictureConsentEnabled: true,
            ...args,
          });
        } catch (error) {
          caughtError = error;
        }

        // ASSERT
        expect(caughtError).toBeInstanceOf(InvalidArgumentError);
        expect(
          (caughtError as InvalidArgumentError).originalError.message,
        ).toBe(expectedErrorMessage);
      },
    );
  });

  describe("Success response", () => {
    it("should return the correct response", () => {
      // ARRANGE
      const command = new RequestMasterConsentCommand({
        languagePackConsentEnabled: true,
        lockScreenPictureConsentEnabled: true,
        appNumber: 1,
        appStorageNumber: 1,
      });
      const expectedResult = {
        data: undefined,
        status: "SUCCESS",
      };

      // ACT
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([]),
        }),
      );
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("Error response", () => {
    it("should return a RequestMasterConsentCommandError for status 0x5501", () => {
      // ARRANGE
      const command = new RequestMasterConsentCommand({
        languagePackConsentEnabled: true,
        lockScreenPictureConsentEnabled: true,
        appNumber: 1,
        appStorageNumber: 1,
      });
      const expectedResult = CommandResultFactory({
        error: new RequestMasterConsentCommandError({
          message: "Consent failed",
          errorCode: "5501",
        }),
      });

      // ACT
      const commandResult = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x55, 0x01]),
          data: Uint8Array.from([]),
        }),
      );

      // ASSERT
      expect(commandResult).toEqual(expectedResult);
    });

    it("should return a RequestMasterConsentCommandError for status 0x5502", () => {
      // ARRANGE
      const command = new RequestMasterConsentCommand({
        languagePackConsentEnabled: true,
        lockScreenPictureConsentEnabled: true,
        appNumber: 1,
        appStorageNumber: 1,
      });
      const expectedResult = CommandResultFactory({
        error: new RequestMasterConsentCommandError({
          message: "PIN not validated",
          errorCode: "5502",
        }),
      });

      // ACT
      const commandResult = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x55, 0x02]),
          data: Uint8Array.from([]),
        }),
      );

      // ASSERT
      expect(commandResult).toEqual(expectedResult);
    });
  });
});
