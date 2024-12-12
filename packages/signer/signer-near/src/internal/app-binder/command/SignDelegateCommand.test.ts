import {
  ApduResponse,
  CommandResultFactory,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { SignDelegateCommand } from "@internal/app-binder/command/SignDelegateCommand";

const SIGN_DELEGATE_ACTION_DATA = Uint8Array.from([
  0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01, 0x8d, 0x80, 0x00, 0x00, 0x00, 0x80,
  0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00, 0x00, 0x62, 0x6f,
  0x62, 0x2e, 0x6e, 0x65, 0x61, 0x72, 0x0a, 0x00, 0x00, 0x00, 0x61, 0x6c, 0x69,
  0x63, 0x65, 0x2e, 0x6e, 0x65, 0x61, 0x72, 0x01, 0x00, 0x00, 0x00, 0x03, 0x00,
  0x00, 0xc0, 0x71, 0xf0, 0xd1, 0x2b, 0x84, 0xc3, 0x1f, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xc9, 0xf0, 0x5d, 0x99, 0x1d, 0x00, 0x00, 0x00, 0x94, 0x88, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc4, 0xf5, 0x94, 0x1e, 0x81, 0xe0, 0x71,
  0xc2, 0xfd, 0x1d, 0xae, 0x2e, 0x71, 0xfd, 0x3d, 0x85, 0x9d, 0x46, 0x24, 0x84,
  0x39, 0x1d, 0x9a, 0x90, 0xbf, 0x21, 0x92, 0x11, 0xdc, 0xbb, 0x32, 0x0f,
]);

const EXPECTED_LAST_APDU = Uint8Array.from([
  ...[0x80, 0x08, 0x80, 0x57, 0x74],
  ...SIGN_DELEGATE_ACTION_DATA,
]);

const EXPECTED_FIRST_APDU = Uint8Array.from([
  ...[0x80, 0x08, 0x00, 0x57, 0x74],
  ...SIGN_DELEGATE_ACTION_DATA,
]);

describe("SignDelegateCommand", () => {
  describe("getApdu", () => {
    it("should create a correct apdu if last chunk", () => {
      // given
      const command = new SignDelegateCommand({
        isLastChunk: true,
        data: SIGN_DELEGATE_ACTION_DATA,
      });
      // when
      const apdu = command.getApdu();
      //then
      expect(apdu.getRawApdu()).toStrictEqual(EXPECTED_LAST_APDU);
    });
    it("should create a correct apdu if not last chunk", () => {
      // given
      const command = new SignDelegateCommand({
        isLastChunk: false,
        data: SIGN_DELEGATE_ACTION_DATA,
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
      const command = new SignDelegateCommand({
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
      const command = new SignDelegateCommand({
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
        const command = new SignDelegateCommand({
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
