import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetWalletIdCommand } from "@internal/app-binder/command/GetWalletIdCommand";

const EXPECTED_APDU = Uint8Array.from([
  0x80, 0x05, 0x00, 0x00, 0x14, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01, 0x8d,
  0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x01,
]);
const APDU_RESPONSE = Uint8Array.from([
  0xdc, 0xb7, 0xcb, 0x6a, 0xcd, 0x9b, 0x77, 0x07, 0x87, 0x68, 0xb7, 0x99, 0xa6,
  0x5b, 0x12, 0x4f, 0xbc, 0xd2, 0xc8, 0xa1, 0x2f, 0x43, 0x25, 0xe7, 0x80, 0xa8,
  0xd6, 0x3a, 0x24, 0xb4, 0xd0, 0x44,
]);

describe("GetWalletIdCommand", () => {
  describe("getApdu", () => {
    it("should create a correct apdu when check on device true", () => {
      // given
      const command = new GetWalletIdCommand({
        derivationPath: "44'/397'/0'/0'/1",
      });
      //when
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(EXPECTED_APDU);
    });
  });
  describe("parseResponse", () => {
    it("should parse the apdu response correctly", () => {
      const response = new ApduResponse({
        data: APDU_RESPONSE,
        statusCode: Uint8Array.from([0x90, 0x00]),
      });
      const command = new GetWalletIdCommand({
        derivationPath: "44'/397'/0'/0'/1",
      });
      // when
      const result = command.parseResponse(response);
      // then
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual(
          "dcb7cb6acd9b77078768b799a65b124fbcd2c8a12f4325e780a8d63a24b4d044",
        );
      } else {
        fail("Except success result, encountered an error");
      }
    });
    describe("error handling", () => {
      it("should return error if response is not success", () => {
        const response = new ApduResponse({
          data: APDU_RESPONSE,
          statusCode: Uint8Array.from([0x00, 0x00]),
        });
        const command = new GetWalletIdCommand({
          derivationPath: "44'/397'/0'/0'/1",
        });
        // when
        const result = command.parseResponse(response);
        // then
        expect(isSuccessCommandResult(result)).toBe(false);
      });
    });
  });
});
