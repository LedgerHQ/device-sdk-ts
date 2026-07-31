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

  describe("name", () => {
    it("should be 'getAppConfiguration'", () => {
      expect(command.name).toBe("getAppConfiguration");
    });
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
            transactionChecksEnabled: false,
            transactionChecksOptIn: false,
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
            transactionChecksEnabled: false,
            transactionChecksOptIn: false,
          },
        }),
      );
    });

    it("should be backward-compatible with the 5-byte layout (no txc bytes)", () => {
      // Oldest firmware: [blind][pubkey][major][minor][patch] — no transaction checks.
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x01, 0x00, 0x01, 0x05, 0x0a]),
      });
      const parsed = command.parseResponse(response);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            blindSigningEnabled: true,
            pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
            version: "1.5.10",
            transactionChecksEnabled: false,
            transactionChecksOptIn: false,
          },
        }),
      );
    });

    it("should parse the 7-byte transaction-check (txc) layout (tx-check flags appended after version)", () => {
      // [blind][pubkey][maj][min][patch][txCheckOptIn][txCheckEnable]
      // 00 00 01 10 00 01 01 => v1.16.0, tx-check opt-in + enabled.
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x00, 0x00, 0x01, 0x10, 0x00, 0x01, 0x01]),
      });
      const parsed = command.parseResponse(response);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            blindSigningEnabled: false,
            pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
            version: "1.16.0",
            transactionChecksEnabled: true,
            transactionChecksOptIn: true,
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
