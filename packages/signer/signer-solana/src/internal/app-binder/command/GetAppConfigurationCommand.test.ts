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
            web3ChecksEnabled: false,
            web3ChecksOptIn: false,
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
            web3ChecksEnabled: false,
            web3ChecksOptIn: false,
          },
        }),
      );
    });

    it("should parse extended feature flags from a 6th byte", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x01, 0x00, 0x02, 0x05, 0x0a, 0x30]),
      });
      const parsed = command.parseResponse(response);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            blindSigningEnabled: true,
            pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
            version: "2.5.10",
            web3ChecksEnabled: true,
            web3ChecksOptIn: true,
          },
        }),
      );
    });

    it("should parse the transaction-checks layout (7 bytes)", () => {
      // [blindSigning, pubKeyDisplayMode, txCheckOptIn, txCheckEnable, major, minor, patch]
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x01, 0x00, 0x01, 0x00, 0x02, 0x05, 0x0a]),
      });
      const parsed = command.parseResponse(response);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            blindSigningEnabled: true,
            pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
            version: "2.5.10",
            web3ChecksEnabled: false,
            web3ChecksOptIn: true,
          },
        }),
      );
    });

    it("should parse the real tx-check app response (1.16.0, enabled)", () => {
      // Device response from app-solana fbe/solana_txc build: 00 00 01 01 01 10 00
      // => blind=false, pubkey=LONG, optIn=true, enable=true, version 1.16.0
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x00, 0x00, 0x01, 0x01, 0x01, 0x10, 0x00]),
      });
      const parsed = command.parseResponse(response);
      expect(parsed).toStrictEqual(
        CommandResultFactory({
          data: {
            blindSigningEnabled: false,
            pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
            version: "1.16.0",
            web3ChecksEnabled: true,
            web3ChecksOptIn: true,
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
