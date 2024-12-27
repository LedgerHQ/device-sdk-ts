import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { BTC_APP_ERRORS, BtcAppCommandError } from "./utils/bitcoinAppErrors";
import {
  GetWalletAddressCommand,
  type GetWalletAddressCommandArgs,
} from "./GetWalletAddressCommand";

describe("GetWalletAddressCommand", () => {
  let command: GetWalletAddressCommand;
  const defaultArgs: GetWalletAddressCommandArgs = {
    display: true,
    walletId: Uint8Array.from("walletIdBuffer", (c) => c.charCodeAt(0)),
    walletHmac: Uint8Array.from("walletHmacBuffer", (c) => c.charCodeAt(0)),
    change: false,
    addressIndex: 0x00000000,
  };

  beforeEach(() => {
    command = new GetWalletAddressCommand(defaultArgs);
    jest.clearAllMocks();
    jest.requireActual("@ledgerhq/device-management-kit");
  });

  describe("getApdu", () => {
    it("should return correct APDU for default arguments", () => {
      const apdu = command.getApdu();
      const expectedApdu = Uint8Array.from([
        0xe1, // CLA
        0x03, // INS
        0x00, // P1
        0x01, // P2
        0x24, // Length of data: 36 bytes
        0x01, // display: true
        ...Uint8Array.from("walletIdBuffer", (c) => c.charCodeAt(0)),
        ...Uint8Array.from("walletHmacBuffer", (c) => c.charCodeAt(0)),
        0x00, // change: false
        0x00,
        0x00,
        0x00,
        0x00, // addressIndex: 0x00000000
      ]);
      expect(apdu.getRawApdu()).toEqual(expectedApdu);
    });

    it("should return correct APDU for different arguments", () => {
      const args: GetWalletAddressCommandArgs = {
        display: false,
        walletId: Uint8Array.from("anotherWalletId", (c) => c.charCodeAt(0)),
        walletHmac: Uint8Array.from("anotherWalletHmac", (c) =>
          c.charCodeAt(0),
        ),
        change: true,
        addressIndex: 0x00000005,
      };
      command = new GetWalletAddressCommand(args);
      const apdu = command.getApdu();
      const expectedApdu = Uint8Array.from([
        0xe1, // CLA
        0x03, // INS
        0x00, // P1
        0x01, // P2
        0x26, // Length of data
        0x00, // display: false
        ...Uint8Array.from("anotherWalletId", (c) => c.charCodeAt(0)),
        ...Uint8Array.from("anotherWalletHmac", (c) => c.charCodeAt(0)),
        0x01, // change: true
        0x00,
        0x00,
        0x00,
        0x05, // addressIndex: 0x00000005
      ]);
      expect(apdu.getRawApdu()).toEqual(expectedApdu);
    });
  });

  describe("parseResponse", () => {
    it("should parse the response and extract the address", () => {
      const responseData = Uint8Array.from("myAddressData", (c) =>
        c.charCodeAt(0),
      );
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: responseData,
      });

      const result = command.parseResponse(response);

      expect(result).toStrictEqual(
        CommandResultFactory({
          data: {
            address: new TextDecoder().decode(responseData),
          },
        }),
      );
    });

    it("should return an error if response status code is an error code", () => {
      const errorStatusCode = Uint8Array.from([0x69, 0x85]);
      const response = new ApduResponse({
        statusCode: errorStatusCode,
        data: new Uint8Array(),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BtcAppCommandError);
        const error = result.error as BtcAppCommandError;
        const expectedErrorInfo = BTC_APP_ERRORS["6985"];
        expect(expectedErrorInfo).toBeDefined();
        if (expectedErrorInfo) {
          expect(error.message).toBe(expectedErrorInfo.message);
        }
      } else {
        fail("Expected error");
      }
    });

    it("should return an error if address cannot be extracted", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error.originalError).toEqual(
          expect.objectContaining({
            message: "Failed to extract address from response",
          }),
        );
      } else {
        fail("Expected error");
      }
    });
  });
});
