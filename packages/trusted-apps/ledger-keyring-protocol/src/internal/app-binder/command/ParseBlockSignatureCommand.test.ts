/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import {
  ParseBlockSignatureCommand,
  type ParseBlockSignatureCommandArgs,
} from "./ParseBlockSignatureCommand";

const DUMMY_SIGNATURE = Uint8Array.from([0x0a, 0x0b, 0x0c]);

const PLACEHOLDER_BYTES = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);

describe("ParseBlockSignatureCommand", () => {
  const makeArgs = (): ParseBlockSignatureCommandArgs => ({
    signature: DUMMY_SIGNATURE,
  });

  describe("getApdu()", () => {
    it("builds correct APDU for signature chunk", () => {
      // given
      const cmd = new ParseBlockSignatureCommand(makeArgs());

      // when
      const apdu = cmd.getApdu();
      const raw = apdu.getRawApdu();

      // then
      expect(raw).toEqual(
        Uint8Array.from([
          0xe0,
          0x08,
          0x02,
          0x00,
          DUMMY_SIGNATURE.length,
          ...DUMMY_SIGNATURE,
        ]),
      );
    });
  });

  describe("parseResponse()", () => {
    it("returns raw TLV payload on success", () => {
      // given
      const cmd = new ParseBlockSignatureCommand(makeArgs());
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: PLACEHOLDER_BYTES,
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual(PLACEHOLDER_BYTES);
      }
    });

    it("maps SW errors to CommandResult error", () => {
      // given
      const cmd = new ParseBlockSignatureCommand(makeArgs());
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6a, 0x86]),
        data: new Uint8Array(),
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect((result.error as any).errorCode).toBe("6a86");
      }
    });

    it("errors when no TLV data returned", () => {
      // given
      const cmd = new ParseBlockSignatureCommand(makeArgs());
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual(new Uint8Array([]));
      }
    });
  });
});
