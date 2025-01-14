import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import {
  BTC_APP_ERRORS,
  BtcAppCommandErrorFactory,
} from "@internal/app-binder/command/utils/bitcoinAppErrors";

import {
  GetExtendedPublicKeyCommand,
  type GetExtendedPublicKeyCommandArgs,
} from "./GetExtendedPublicKeyCommand";

const GET_EXTENDED_PUBLIC_KEY_APDU_WITH_DISPLAY = new Uint8Array([
  0xe1, 0x00, 0x00, 0x00, 0x0e, 0x01, 0x03, 0x80, 0x00, 0x00, 0x54, 0x80, 0x00,
  0x00, 0x00, 0x80, 0x00, 0x00, 0x00,
]);

const GET_EXTENDED_PUBLIC_KEY_APDU_WITHOUT_DISPLAY = new Uint8Array([
  0xe1, 0x00, 0x00, 0x00, 0x0e, 0x00, 0x03, 0x80, 0x00, 0x00, 0x54, 0x80, 0x00,
  0x00, 0x00, 0x80, 0x00, 0x00, 0x00,
]);

const GET_EXTENDED_PUBLIC_KEY_APDU_WITH_OTHER_DERIVATION_PATH = new Uint8Array([
  0xe1, 0x00, 0x00, 0x00, 0x12, 0x01, 0x04, 0x80, 0x00, 0x00, 0x31, 0x80, 0x00,
  0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const GET_EXTENDED_PUBLIC_KEY_VALID_RESPONSE = new Uint8Array([
  0x78, 0x70, 0x75, 0x62, 0x36, 0x44, 0x39, 0x50, 0x70, 0x34, 0x72, 0x46, 0x76,
  0x77, 0x54, 0x47, 0x78, 0x38, 0x38, 0x59, 0x44, 0x34, 0x43, 0x44, 0x61, 0x31,
  0x6e, 0x42, 0x45, 0x70, 0x63, 0x4b, 0x45, 0x5a, 0x54, 0x43, 0x4e, 0x46, 0x7a,
  0x43, 0x46, 0x37, 0x67, 0x56, 0x50, 0x7a, 0x36, 0x54, 0x68, 0x39, 0x42, 0x61,
  0x56, 0x68, 0x68, 0x50, 0x4a, 0x44, 0x75, 0x67, 0x39, 0x59, 0x59, 0x46, 0x50,
  0x59, 0x6d, 0x6b, 0x53, 0x48, 0x4c, 0x66, 0x52, 0x31, 0x56, 0x51, 0x59, 0x6a,
  0x35, 0x6a, 0x61, 0x79, 0x71, 0x77, 0x53, 0x59, 0x41, 0x52, 0x6e, 0x75, 0x42,
  0x4a, 0x69, 0x50, 0x53, 0x44, 0x61, 0x62, 0x79, 0x79, 0x54, 0x69, 0x43, 0x44,
  0x37, 0x42, 0x33, 0x63, 0x6a, 0x50, 0x71,
]);

describe("GetExtendedPublicKeyCommand", () => {
  let command: GetExtendedPublicKeyCommand;
  const defaultArgs: GetExtendedPublicKeyCommandArgs = {
    checkOnDevice: true,
    derivationPath: "84'/0'/0'",
  };

  beforeEach(() => {});

  describe("getApdu", () => {
    it("should return the correct APDU", () => {
      // GIVEN
      command = new GetExtendedPublicKeyCommand(defaultArgs);

      // WHEN
      const apdu = command.getApdu();

      //THEN
      expect(apdu.getRawApdu()).toEqual(
        GET_EXTENDED_PUBLIC_KEY_APDU_WITH_DISPLAY,
      );
    });

    it("should return the correct APDU without display", () => {
      // GIVEN
      command = new GetExtendedPublicKeyCommand({
        ...defaultArgs,
        checkOnDevice: false,
      });

      // WHEN
      const apdu = command.getApdu();

      //THEN
      expect(apdu.getRawApdu()).toEqual(
        GET_EXTENDED_PUBLIC_KEY_APDU_WITHOUT_DISPLAY,
      );
    });

    it("should return the correct APDU with different derivation path", () => {
      // GIVEN
      command = new GetExtendedPublicKeyCommand({
        ...defaultArgs,
        derivationPath: "49'/0'/0'/0",
      });

      // WHEN
      const apdu = command.getApdu();

      //THEN
      expect(apdu.getRawApdu()).toEqual(
        GET_EXTENDED_PUBLIC_KEY_APDU_WITH_OTHER_DERIVATION_PATH,
      );
    });
  });

  describe("parseResponse", () => {
    it("should return the extended public key", () => {
      // GIVEN
      command = new GetExtendedPublicKeyCommand(defaultArgs);
      const response = new ApduResponse({
        data: GET_EXTENDED_PUBLIC_KEY_VALID_RESPONSE,
        statusCode: new Uint8Array([0x90, 0x00]),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      expect(result).toEqual(
        CommandResultFactory({
          data: {
            extendedPublicKey:
              "xpub6D9Pp4rFvwTGx88YD4CDa1nBEpcKEZTCNFzCF7gVPz6Th9BaVhhPJDug9YYFPYmkSHLfR1VQYj5jayqwSYARnuBJiPSDabyyTiCD7B3cjPq",
          },
        }),
      );
    });

    it("should return an error if the response is not successful", () => {
      // GIVEN
      command = new GetExtendedPublicKeyCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6d, 0x00]),
        data: new Uint8Array(0),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: BtcAppCommandErrorFactory({
            ...BTC_APP_ERRORS["6d00"],
            errorCode: "6d00",
          }),
        }),
      );
    });

    it("should return an error if the response is too short", () => {
      // GIVEN
      command = new GetExtendedPublicKeyCommand(defaultArgs);
      const response = new ApduResponse({
        data: Uint8Array.from([]),
        statusCode: new Uint8Array([0x90, 0x00]),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("Invalid response length"),
        }),
      );
    });
  });
});
