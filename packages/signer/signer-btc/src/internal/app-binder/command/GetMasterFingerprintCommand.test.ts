import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { InvalidStatusWordError } from "@ledgerhq/device-management-kit";

import { GetMasterFingerprintCommand } from "./GetMasterFingerprintCommand";

const GET_MASTER_FINGERPRINT_APDU = new Uint8Array([
  0xe1, 0x05, 0x00, 0x00, 0x00,
]);

const GET_MASTER_FINGERPRINT_RESPONSE = new Uint8Array([
  0x82, 0x8d, 0xc2, 0xf3,
]);

describe("GetMasterFingerprintCommand", () => {
  let command: GetMasterFingerprintCommand;

  beforeEach(() => {
    command = new GetMasterFingerprintCommand();
  });

  describe("getApdu", () => {
    it("returns the correct APDU", () => {
      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toEqual(GET_MASTER_FINGERPRINT_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should return the master fingerprint", () => {
      // GIVEN
      const response = new ApduResponse({
        data: GET_MASTER_FINGERPRINT_RESPONSE,
        statusCode: new Uint8Array([0x90, 0x00]),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      expect(result).toEqual(
        CommandResultFactory({
          data: {
            masterFingerprint: Uint8Array.from([0x82, 0x8d, 0xc2, 0xf3]),
          },
        }),
      );
    });

    it("should return an error if the response is not successful", () => {
      // GIVEN
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6d, 0x00]),
        data: new Uint8Array(0),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error if the response is too short", () => {
      // GIVEN
      const response = new ApduResponse({
        data: GET_MASTER_FINGERPRINT_RESPONSE.slice(0, 2),
        statusCode: new Uint8Array([0x90, 0x00]),
      });

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toEqual(
          new InvalidStatusWordError("Master fingerprint is missing"),
        );
      } else {
        assert.fail("Expected an error, but the result was successful");
      }
    });
  });
});
