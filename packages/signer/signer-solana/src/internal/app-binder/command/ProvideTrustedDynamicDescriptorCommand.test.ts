import {
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideTrustedDynamicDescriptorCommand } from "./ProvideTrustedDynamicDescriptorCommand";

const CLA = 0xe0;
const INS = 0x22;
const P1 = 0x00;
const P2 = 0x00;

const EXPECTED_APDU = Uint8Array.from([
  CLA,
  INS,
  P1,
  P2,
  0x0a,
  0x04,
  0xf0,
  0xca,
  0xcc,
  0x1a,
  0x04,
  0x01,
  0x02,
  0x03,
  0x04,
]);

describe("ProvideTrustedDynamicDescriptorCommand", () => {
  let command: ProvideTrustedDynamicDescriptorCommand;

  beforeEach(() => {
    command = new ProvideTrustedDynamicDescriptorCommand({
      data: "f0cacc1a",
      signature: "01020304",
    });
  });

  describe("getApdu", () => {
    it("should construct the correct APDU with LV(data)||LV(signature)", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(EXPECTED_APDU);
    });

    it("should accept 0x-prefixed hex strings and build the same APDU", () => {
      const withPrefix = new ProvideTrustedDynamicDescriptorCommand({
        data: "0xf0cacc1a",
        signature: "0x01020304",
      });
      const apdu = withPrefix.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(EXPECTED_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should return success when status is 0x9000 and no data", () => {
      const LNX_RESPONSE_GOOD = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      };

      const parsed = command.parseResponse(LNX_RESPONSE_GOOD);
      expect(parsed).toStrictEqual(CommandResultFactory({ data: undefined }));
      expect(isSuccessCommandResult(parsed)).toBe(true);
    });

    it("should return an error if the status code is not 0x9000", () => {
      const LNX_RESPONSE_ERROR = {
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: new Uint8Array(),
      };

      const result = command.parseResponse(LNX_RESPONSE_ERROR);
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error if response contains unexpected data", () => {
      const LNX_RESPONSE_EXTRA = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x01]),
      };

      const result = command.parseResponse(LNX_RESPONSE_EXTRA);
      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-expect-error response is not typed
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    });
  });
});
