import {
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Maybe } from "purify-ts";

import { ProvideTrustedNamePKICommand } from "./ProvideTrustedNamePKICommand";

const CLA = 0xb0;
const INS = 0x06;
const P1 = 0x04;
const P2 = 0x00;

const EXPECTED_APDU = Uint8Array.from([
  CLA,
  INS,
  P1,
  P2,
  0x08,
  0xde,
  0xad,
  0xbe,
  0xef,
  0x15,
  0x02,
  0x01,
  0x02,
]);

describe("ProvideTrustedNamePKICommand", () => {
  let command: ProvideTrustedNamePKICommand;

  beforeEach(() => {
    command = new ProvideTrustedNamePKICommand({
      descriptor: Uint8Array.from([0xde, 0xad, 0xbe, 0xef]),
      signature: Uint8Array.from([0x01, 0x02]),
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
      expect(parsed).toStrictEqual(
        CommandResultFactory({ data: Maybe.of(null) }),
      );
      expect(isSuccessCommandResult(parsed)).toBe(true);
    });

    it("should return an error if the status code is not 0x9000", () => {
      const LNX_RESPONSE_ERROR = {
        statusCode: Uint8Array.from([0x55, 0x15]),
        data: new Uint8Array(),
      };

      const result = command.parseResponse(LNX_RESPONSE_ERROR);
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error if response contains unexpected data", () => {
      const LNX_RESPONSE_EXTRA = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x00]),
      };

      const result = command.parseResponse(LNX_RESPONSE_EXTRA);
      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-ignore
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    });
  });
});
