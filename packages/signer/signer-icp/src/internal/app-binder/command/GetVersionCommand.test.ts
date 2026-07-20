import {
  ApduBuilder,
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  GetVersionCommand,
  icpGetVersionApduHeader,
} from "@internal/app-binder/command/GetVersionCommand";
import {
  type IcpAppCommandError,
  IcpErrorCodes,
} from "@internal/app-binder/command/utils/IcpApplicationErrors";

describe("GetVersionCommand", () => {
  let command: GetVersionCommand;

  beforeEach(() => {
    command = new GetVersionCommand();
  });

  describe("name", () => {
    it("should be 'GetVersion'", () => {
      // ASSERT
      expect(command.name).toBe("GetVersion");
    });
  });

  describe("getApdu", () => {
    it("should return APDU with CLA=0x11, INS=0x00, P1=0x00, P2=0x00 and no data", () => {
      // ARRANGE
      const expected = new ApduBuilder(icpGetVersionApduHeader).build();
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.getRawApdu());
    });
  });

  describe("parseResponse", () => {
    it("should return version, testMode and locked on success", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00]), // TEST, major=1, minor=2, patch=3, LOCKED=0
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: { version: "1.2.3", testMode: false, locked: false },
        }),
      );
      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should report testMode true when TEST byte is 0xFF", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0xff, 0x01, 0x02, 0x03, 0x00]),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.testMode).toBe(true);
      }
    });

    it("should report locked true when LOCKED byte is non-zero", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x01]),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.locked).toBe(true);
      }
    });

    it("should return IcpAppCommandError with error code 0x6984 when status is 0x6984", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x84]),
        data: new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00]),
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as IcpAppCommandError;
        expect((err.originalError as { errorCode: string }).errorCode).toBe(
          IcpErrorCodes.DATA_INVALID.slice(2),
        );
      }
    });

    it("should return InvalidStatusWordError when version bytes are missing", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x00, 0x01]), // only TEST + major
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
