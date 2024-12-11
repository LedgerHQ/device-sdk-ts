import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetVersionCommand } from "@internal/app-binder/command/GetVersionCommand";

const EXPECTED_APDU = Uint8Array.from([0x80, 0x06, 0x00, 0x00, 0x00]);
const RESPONSE_APDU = Uint8Array.from([0x02, 0x02, 0x01]);

describe("GetVersionCommand", () => {
  describe("getApdu", () => {
    it("should create a correct apdu", () => {
      // given
      const command = new GetVersionCommand();
      // when
      const apdu = command.getApdu();
      //then
      expect(apdu.getRawApdu()).toStrictEqual(EXPECTED_APDU);
    });
  });
  describe("parseResponse", () => {
    it("should parse the apdu response correctly", () => {
      // given
      const response = new ApduResponse({
        data: RESPONSE_APDU,
        statusCode: Uint8Array.from([0x90, 0x00]),
      });
      const command = new GetVersionCommand();
      // when
      const result = command.parseResponse(response);
      // then
      if (isSuccessCommandResult(result)) {
        expect(result).toStrictEqual(
          CommandResultFactory({
            data: { version: "2.2.1" },
          }),
        );
      }
    });
    describe("error handling", () => {
      it("should return error if response is not success", () => {
        // given
        const response = new ApduResponse({
          data: RESPONSE_APDU,
          statusCode: Uint8Array.from([0x60, 0x00]),
        });
        const command = new GetVersionCommand();
        // when
        const result = command.parseResponse(response);
        // then
        expect(isSuccessCommandResult(result)).toStrictEqual(false);
      });
    });
  });
});
