import {
  ApduBuilder,
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  COSMOS_GET_APP_CONFIG_APDU_HEADER,
  GetAppConfigCommand,
} from "@internal/app-binder/command/GetAppConfigCommand";
import {
  type CosmosAppCommandError,
  CosmosErrorCodes,
} from "@internal/app-binder/command/utils/CosmosApplicationErrors";

describe("GetAppConfigCommand", () => {
  let command: GetAppConfigCommand;

  beforeEach(() => {
    command = new GetAppConfigCommand();
  });

  describe("name", () => {
    it("should be 'GetAppConfig'", () => {
      // ASSERT
      expect(command.name).toBe("GetAppConfig");
    });
  });

  describe("getApdu", () => {
    it("should return APDU with CLA=0x55, INS=0x00, P1=0x00, P2=0x00 and no data", () => {
      // ARRANGE: command is created in beforeEach
      const expected = new ApduBuilder(
        COSMOS_GET_APP_CONFIG_APDU_HEADER,
      ).build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
    });
  });

  describe("parseResponse", () => {
    it("should return major, minor, patch on success", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x55, 0x01, 0x02, 0x03]), // CLA, major=1, minor=2, patch=3
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(result).toStrictEqual(
        CommandResultFactory({ data: { major: 1, minor: 2, patch: 3 } }),
      );
      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should return CosmosAppCommandError with error code 0x6984 and message 'Data Invalid' when status is 0x6984", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x84]),
        data: new Uint8Array([0x55, 0x01, 0x02, 0x03]),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as CosmosAppCommandError;
        expect((err.originalError as { errorCode: string }).errorCode).toBe(
          CosmosErrorCodes.DATA_INVALID.slice(2),
        );
      }
    });

    it("should return InvalidStatusWordError when version is missing", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x55, 0x01]), // only CLA + major; minor and patch missing
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect(err).toBeInstanceOf(InvalidStatusWordError);
        expect((err.originalError as { message: string }).message).toBe(
          "Cannot extract version",
        );
      }
    });
  });
});
