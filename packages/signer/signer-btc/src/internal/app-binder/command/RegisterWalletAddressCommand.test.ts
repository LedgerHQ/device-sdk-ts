import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { RegisterWalletAddressCommand } from "@internal/app-binder/command/RegisterWalletAddressCommand";

const POLICY_HASH_DATA = Uint8Array.from([
  0x7c, 0x67, 0xe8, 0x4f, 0x99, 0x74, 0x46, 0x71, 0x14, 0x93, 0xef, 0x8b, 0x74,
  0x70, 0xb1, 0x0f, 0x60, 0x4b, 0x02, 0xd2, 0x58, 0x4f, 0xa0, 0x44, 0x6f, 0xce,
  0xf7, 0xd9, 0x89, 0x83, 0xe3, 0xdc,
]);
const KEYS_LENGTH = 0x02;
const KEYS_HASH_DATA = Uint8Array.from([
  0x4b, 0xc5, 0x46, 0x7f, 0x24, 0x93, 0x85, 0xb2, 0x9e, 0x5b, 0x8e, 0xc9, 0xfb,
  0x24, 0xcc, 0x65, 0xa3, 0x71, 0x0b, 0x1a, 0x26, 0xd2, 0x8d, 0xe9, 0xf5, 0xc4,
  0xf3, 0xf4, 0x5d, 0xd6, 0x54, 0xc1,
]);
const POLICY_NAME_DATA = Uint8Array.from([
  0x02, 0x0c, 0x43, 0x6f, 0x6c, 0x64, 0x20, 0x73, 0x74, 0x6f, 0x72, 0x61, 0x67,
  0x65, 0x1e,
]);
const POLICY_VERSION = 0x02;
const WALLET_POLICY_DATA = Uint8Array.from(
  [POLICY_VERSION]
    .concat(...POLICY_NAME_DATA)
    .concat(...POLICY_HASH_DATA)
    .concat([KEYS_LENGTH])
    .concat(...KEYS_HASH_DATA),
);
const EXPECTED_RAW_APDU = Uint8Array.from(
  [0xe1, 0x02, 0x00, 0x01, 0x51].concat(...WALLET_POLICY_DATA),
);
const APDU_RESPONSE = Uint8Array.from([
  0x1d, 0x15, 0x0e, 0xd4, 0x25, 0xa8, 0x71, 0xa5, 0xca, 0x7e, 0x2c, 0x55, 0xdb,
  0x1b, 0x32, 0x95, 0xc1, 0xfd, 0x97, 0x14, 0x7f, 0xd0, 0xa7, 0xb1, 0x88, 0xd4,
  0x32, 0x7f, 0x4b, 0xa7, 0x40, 0x2a, 0xfa, 0x73, 0xe3, 0x61, 0x19, 0x32, 0x4f,
  0xbe, 0x4c, 0xc1, 0xca, 0x94, 0xaa, 0x84, 0x2c, 0x62, 0x61, 0x52, 0x6d, 0x44,
  0x11, 0x2a, 0x22, 0x16, 0x4b, 0xc5, 0x7c, 0x33, 0x35, 0x10, 0x2b, 0x04,
]);

describe("RegisterWalletAddressCommand", () => {
  describe("getApdu", () => {
    it("should send the correct APDU", () => {
      // when
      const command = new RegisterWalletAddressCommand({
        walletPolicy: WALLET_POLICY_DATA,
      });

      // then
      expect(command.getApdu().getRawApdu()).toEqual(EXPECTED_RAW_APDU);
    });
  });
  describe("parseResponse", () => {
    it("should parse the response correctly", () => {
      // given
      const command = new RegisterWalletAddressCommand({
        walletPolicy: WALLET_POLICY_DATA,
      });
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: APDU_RESPONSE,
      });

      // then
      expect(command.parseResponse(response)).toEqual(
        CommandResultFactory({
          data: {
            walletId: APDU_RESPONSE.slice(0, 32),
            walletHmac: APDU_RESPONSE.slice(32),
          },
        }),
      );
    });

    it("should return an error if the response is not successful", () => {
      // given
      const command = new RegisterWalletAddressCommand({
        walletPolicy: WALLET_POLICY_DATA,
      });
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6d, 0x00]),
        data: new Uint8Array(0),
      });

      // when
      const result = command.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(false);
    });
    it("should return an error if the response is too short", () => {
      // given
      const command = new RegisterWalletAddressCommand({
        walletPolicy: WALLET_POLICY_DATA,
      });
      const response = new ApduResponse({
        data: APDU_RESPONSE.slice(0, 2),
        statusCode: new Uint8Array([0x90, 0x00]),
      });

      // when
      const result = command.parseResponse(response);

      // then
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toEqual(
          new InvalidStatusWordError("Data mismatch"),
        );
      } else {
        fail("Expected an error, but the result was successful");
      }
    });
  });
});
