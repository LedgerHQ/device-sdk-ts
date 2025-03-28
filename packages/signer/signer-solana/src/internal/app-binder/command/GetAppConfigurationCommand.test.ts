import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";

import { GetAppConfigurationCommand } from "./GetAppConfigurationCommand";

const GET_APP_CONFIG_APDU = new Uint8Array([0xe0, 0x04, 0x00, 0x00, 0x00]);

const GET_APP_CONFIG_RESPONSE_DATA = new Uint8Array([
  0x01, 0x00, 0x02, 0x05, 0x0a,
]);

const GET_APP_CONFIG_RESPONSE = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: GET_APP_CONFIG_RESPONSE_DATA,
});

const GET_APP_CONFIG_RESPONSE_DATA_SHORT_PUB_KEY_DISPLAY_MODE = new Uint8Array([
  0x01, 0x01, 0x02, 0x05, 0x0a,
]);

const GET_APP_CONFIG_RESPONSE_SHORT_PUB_KEY_DISPLAY_MODE = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: GET_APP_CONFIG_RESPONSE_DATA_SHORT_PUB_KEY_DISPLAY_MODE,
});

describe("GetAppConfigurationCommand", () => {
  let command: GetAppConfigurationCommand;

  beforeEach(() => {
    command = new GetAppConfigurationCommand();
    vi.clearAllMocks();
    vi.importActual("@ledgerhq/device-management-kit");
  });

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toEqual(GET_APP_CONFIG_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should parse the response correctly", () => {
      const parsed = command.parseResponse(GET_APP_CONFIG_RESPONSE);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            blindSigningEnabled: true,
            pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
            version: "2.5.10",
          },
        }),
      );
    });

    it("should parse the response correctly with short pub key display mode", () => {
      const parsed = command.parseResponse(
        GET_APP_CONFIG_RESPONSE_SHORT_PUB_KEY_DISPLAY_MODE,
      );
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            blindSigningEnabled: true,
            pubKeyDisplayMode: PublicKeyDisplayMode.SHORT,
            version: "2.5.10",
          },
        }),
      );
    });

    describe("error handling", () => {
      it("should return error if response is not success", () => {
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x6a, 0x82]),
          data: new Uint8Array(0),
        });
        const result = command.parseResponse(response);
        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toEqual(
            expect.objectContaining({
              _tag: "SolanaAppCommandError",
              errorCode: "6a82",
              message: "Invalid off-chain message format",
            }),
          );
        } else {
          assert.fail("Expected error");
        }
      });

      it("should return error if response is not success", () => {
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x6a, 0x82]),
          data: new Uint8Array(0),
        });
        const result = command.parseResponse(response);
        expect(isSuccessCommandResult(result)).toBe(false);
        if (!isSuccessCommandResult(result)) {
          expect(result.error).toEqual(
            expect.objectContaining({
              _tag: "SolanaAppCommandError",
              errorCode: "6a82",
              message: "Invalid off-chain message format",
            }),
          );
        } else {
          assert.fail("Expected error");
        }
      });
    });
  });
});
