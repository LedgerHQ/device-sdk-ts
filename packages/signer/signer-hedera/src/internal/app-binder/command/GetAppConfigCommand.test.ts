import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";
import {
  HEDERA_CLA,
  INS,
  P1,
  P2_DEFAULT,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import { HederaAppCommandError } from "./utils/hederaApplicationErrors";

const GET_APP_CONFIG_APDU = new Uint8Array([
  HEDERA_CLA,
  INS.GET_APP_CONFIGURATION,
  P1.DEFAULT,
  P2_DEFAULT,
  0x00,
]);

const makeResponse = (data: number[], statusCode = [0x90, 0x00]) =>
  new ApduResponse({
    statusCode: Uint8Array.from(statusCode),
    data: Uint8Array.from(data),
  });

describe("GetAppConfigCommand", () => {
  let command: GetAppConfigCommand;

  beforeEach(() => {
    command = new GetAppConfigCommand();
  });

  describe("name", () => {
    it("should be 'GetAppConfig'", () => {
      expect(command.name).toBe("GetAppConfig");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(GET_APP_CONFIG_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should parse the storage flag and the version", () => {
      const result = command.parseResponse(
        makeResponse([0x00, 0x01, 0x09, 0x02]),
      );

      expect(result).toStrictEqual(
        CommandResultFactory({
          data: { storageAllowed: false, version: "1.9.2" },
        }),
      );
    });

    it("should report storage as allowed when the flag is set", () => {
      const result = command.parseResponse(
        makeResponse([0x01, 0x01, 0x00, 0x00]),
      );

      expect(result).toStrictEqual(
        CommandResultFactory({
          data: { storageAllowed: true, version: "1.0.0" },
        }),
      );
    });

    describe("error handling", () => {
      it("should return an error on a truncated configuration", () => {
        const result = command.parseResponse(makeResponse([0x00, 0x01]));

        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        }
      });

      it("should map an unknown instruction to a Hedera app error", () => {
        const result = command.parseResponse(makeResponse([], [0x6d, 0x00]));

        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toBeInstanceOf(HederaAppCommandError);
          expect(result.error).toEqual(
            expect.objectContaining({
              _tag: "HederaAppCommandError",
              errorCode: "6d00",
              message: "Unknown instruction",
            }),
          );
        }
      });
    });
  });
});
