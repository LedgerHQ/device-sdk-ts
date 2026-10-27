import {
  ApduBuilder,
  ApduResponse,
  type InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { INS, LEDGER_CLA } from "@internal/app-binder/constants";

import { type TronAppCommandError } from "./utils/tronApplicationErrors";
import { GetAppConfigurationCommand } from "./GetAppConfigurationCommand";

describe("GetAppConfigurationCommand", () => {
  let command: GetAppConfigurationCommand;

  beforeEach(() => {
    command = new GetAppConfigurationCommand();
  });

  describe("name", () => {
    it("should be 'GetAppConfiguration'", () => {
      expect(command.name).toBe("GetAppConfiguration");
    });
  });

  describe("getApdu", () => {
    it("should build the APDU with CLA=0xe0, INS=0x06, P1=0, P2=0 and no data", () => {
      const expected = new ApduBuilder({
        cla: LEDGER_CLA,
        ins: INS.GET_APP_CONFIGURATION,
        p1: 0x00,
        p2: 0x00,
      }).build();

      expect(command.getApdu().getRawApdu()).toStrictEqual(
        expected.getRawApdu(),
      );
    });
  });

  describe("parseResponse", () => {
    it("should decode flags and version (golden vector 0f000105 -> 0.1.5)", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x0f, 0x00, 0x01, 0x05]),
      });
      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({
          version: "0.1.5",
          versionN: 105,
          allowData: true,
          allowContract: true,
          truncateAddress: true,
          signByHash: true,
        });
      }
    });

    it("should apply the legacy overrides for versions below 0.1.2 / 0.1.5", () => {
      // version 0.1.1: allowData forced true, allowContract forced false,
      // truncateAddress forced false.
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x0f, 0x00, 0x01, 0x01]),
      });
      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({
          version: "0.1.1",
          versionN: 101,
          allowData: true,
          allowContract: false,
          truncateAddress: false,
          signByHash: true,
        });
      }
    });

    it("should return a TronAppCommandError on a device error status", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x85]),
        data: new Uint8Array([0x0f, 0x00, 0x01, 0x05]),
      });
      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect((result.error as TronAppCommandError).errorCode).toBe("6985");
      }
    });

    it("should return an InvalidStatusWordError when the version is truncated", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x0f, 0x00]),
      });
      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Cannot extract app configuration",
        );
      }
    });
  });
});
