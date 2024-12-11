import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { GetPublicKeyCommand } from "@internal/app-binder/command/GetPublicKeyCommand";

const EXPECTED_CHECK_DISPLAY_APDU = Uint8Array.from([
  0x80, 0x04, 0x00, 0x00, 0x14, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01, 0x8d,
  0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x01,
]);
const EXPECTED_NO_CHECK_DISPLAY_APDU = Uint8Array.from([
  0x80, 0x04, 0x01, 0x00, 0x14, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01, 0x8d,
  0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x01,
]);
const EXPECTED_RESPONSE = Uint8Array.from([
  0x57, 0xed, 0x56, 0xb2, 0xd0, 0x6b, 0x69, 0xd1, 0xbd, 0xb3, 0xcd, 0x4d, 0x02,
  0xcc, 0xb6, 0xc1, 0x62, 0x3d, 0x1c, 0x18, 0xba, 0xce, 0x4d, 0x0e, 0x9a, 0xfc,
  0x88, 0xd6, 0xe2, 0x4f, 0x8f, 0x13,
]);

describe("GetPublicKeyCommand", () => {
  describe("getApdu", () => {
    it("should create a correct apdu whit checkOnDevice true", () => {
      // given
      const derivationPath = "44'/397'/0'/0'/1";
      const command = new GetPublicKeyCommand({
        derivationPath,
        checkOnDevice: true,
      });
      // when
      const apdu = command.getApdu();
      // then
      expect(apdu.getRawApdu()).toEqual(EXPECTED_CHECK_DISPLAY_APDU);
    });
    it("should create a correct apdu whit checkOnDevice false", () => {
      // given
      const derivationPath = "m/44'/397'/0'/0'/1";
      const command = new GetPublicKeyCommand({
        derivationPath,
        checkOnDevice: false,
      });
      // when
      const apdu = command.getApdu();
      // then
      expect(apdu.getRawApdu()).toEqual(EXPECTED_NO_CHECK_DISPLAY_APDU);
    });
  });
  describe("parseResponse", () => {
    it("should parse the apdu response correctly", () => {
      // given
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: EXPECTED_RESPONSE,
      });
      const derivationPath = "m/44'/397'/0'/0'/1";
      const command = new GetPublicKeyCommand({
        derivationPath,
        checkOnDevice: false,
      });
      // when
      const result = command.parseResponse(response);
      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: "6vENeXbZ2cfP4xeGGvCuvHxZ4B7T9giWfp3YV9c4kthG",
        }),
      );
    });
    describe("error handling", () => {
      it("should return error if response is not success", () => {
        // given
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([]),
        });
        const command = new GetPublicKeyCommand({
          derivationPath: "44'/397'/0'/0'/1",
          checkOnDevice: false,
        });
        // when
        const result = command.parseResponse(response);
        // then
        expect(result).toStrictEqual(
          CommandResultFactory({
            error: new InvalidStatusWordError("Public key is missing"),
          }),
        );
      });
    });
  });
});
