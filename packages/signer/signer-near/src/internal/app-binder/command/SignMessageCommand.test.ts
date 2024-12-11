import {
  ApduResponse,
  CommandResultFactory,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";

const SIGN_MESSAGE_DATA = Uint8Array.from([
  0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01, 0x8d, 0x80, 0x00, 0x00, 0x00, 0x80,
  0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x01, 0x0b, 0x00, 0x00, 0x00, 0x48, 0x65,
  0x6c, 0x6c, 0x6f, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x98, 0xca, 0xe2, 0x76,
  0x66, 0x81, 0x09, 0x7c, 0x3d, 0x97, 0x2f, 0xe1, 0x7c, 0x26, 0xec, 0x29, 0x97,
  0x9c, 0xff, 0x3a, 0x79, 0xfa, 0xdf, 0x17, 0xf9, 0xc8, 0x73, 0x13, 0x2b, 0xe5,
  0x6a, 0x2a, 0x0a, 0x00, 0x00, 0x00, 0x61, 0x6c, 0x69, 0x63, 0x65, 0x2e, 0x6e,
  0x65, 0x61, 0x72, 0x01, 0x12, 0x00, 0x00, 0x00, 0x6d, 0x79, 0x61, 0x70, 0x70,
  0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x63, 0x61, 0x6c, 0x6c, 0x62, 0x61, 0x63, 0x6b,
]);

const EXPECTED_LAST_APDU = Uint8Array.from([
  ...[0x80, 0x07, 0x80, 0x57, 0x68],
  ...SIGN_MESSAGE_DATA,
]);

const EXPECTED_FIRST_APDU = Uint8Array.from([
  ...[0x80, 0x07, 0x00, 0x57, 0x68],
  ...SIGN_MESSAGE_DATA,
]);
describe("SignMessageCommand", () => {
  describe("getApdu", () => {
    it("should create a correct apdu if last chunk", () => {
      // given
      const command = new SignMessageCommand({
        isLastChunk: true,
        data: SIGN_MESSAGE_DATA,
      });
      // when
      const apdu = command.getApdu();
      //then
      expect(apdu.getRawApdu()).toStrictEqual(EXPECTED_LAST_APDU);
    });
    it("should create a correct apdu if not last chunk", () => {
      // given
      const command = new SignMessageCommand({
        isLastChunk: false,
        data: SIGN_MESSAGE_DATA,
      });
      // when
      const apdu = command.getApdu();
      //then
      expect(apdu.getRawApdu()).toStrictEqual(EXPECTED_FIRST_APDU);
    });
  });
  describe("parseResponse", () => {
    it("should return Nothing if not last chunk", () => {
      // given
      const command = new SignMessageCommand({
        data: Uint8Array.from([]),
        isLastChunk: false,
      });
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });
      // when
      const result = command.parseResponse(response);
      // then
      expect(result).toStrictEqual(CommandResultFactory({ data: Nothing }));
    });
    it("should return response data if last chunk", () => {
      // given
      const command = new SignMessageCommand({
        data: Uint8Array.from([0x42, 0x87]),
        isLastChunk: true,
      });
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x76, 0x84, 0x78]),
      });
      // when
      const result = command.parseResponse(response);
      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: Just(Uint8Array.from([0x76, 0x84, 0x78])),
        }),
      );
    });
    describe("error handling", () => {
      it("should return error if response is not success", () => {
        // given
        const command = new SignMessageCommand({
          data: Uint8Array.from([0x42, 0x87]),
          isLastChunk: true,
        });
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x55, 0x15]),
          data: Uint8Array.from([0x76, 0x84, 0x78]),
        });
        // when
        const result = command.parseResponse(response);
        // then
        expect(result).toStrictEqual(
          CommandResultFactory({
            error: GlobalCommandErrorHandler.handle(response),
          }),
        );
      });
    });
  });
});
