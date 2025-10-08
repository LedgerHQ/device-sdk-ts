import {
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideTLVDescriptorCommand } from "./ProvideTLVDescriptorCommand";

const CLA = 0xe0;
const INS = 0x21;
const P1 = 0x00;
const P2 = 0x00;

const EXPECTED_APDU = Uint8Array.from([
  CLA,
  INS,
  P1,
  P2,
  0x04,
  0xde,
  0xad,
  0xbe,
  0xef,
]);

describe("ProvideTLVDescriptorCommand", () => {
  let command: ProvideTLVDescriptorCommand;

  beforeEach(() => {
    command = new ProvideTLVDescriptorCommand({
      payload: Uint8Array.from([0xde, 0xad, 0xbe, 0xef]),
    });
  });

  describe("getApdu", () => {
    it("should construct the correct APDU", () => {
      const apdu = command.getApdu();
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
