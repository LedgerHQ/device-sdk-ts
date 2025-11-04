/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import {
  ParseBlockHeaderCommand,
  type ParseBlockHeaderCommandArgs,
} from "@internal/app-binder/command/ParseStreamBlockHeader";

const HEADER_BYTES = Uint8Array.from([0xab, 0xad, 0xbe, 0xef]);
const TLV_PAYLOAD = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);

describe("ParseBlockHeaderCommand", () => {
  describe("name", () => {
    it("should be 'parseBlockHeader'", () => {
      const args: ParseBlockHeaderCommandArgs = { header: HEADER_BYTES };
      const cmd = new ParseBlockHeaderCommand(args);
      expect(cmd.name).toBe("parseBlockHeader");
    });
  });

  describe("getApdu()", () => {
    it("should build the correct APDU for a given header", () => {
      // given
      const args: ParseBlockHeaderCommandArgs = { header: HEADER_BYTES };
      const cmd = new ParseBlockHeaderCommand(args);

      // when
      const apdu = cmd.getApdu();
      const expected = Uint8Array.from([
        0xe0,
        0x08,
        0x00,
        0x00,
        HEADER_BYTES.length,
        ...HEADER_BYTES,
      ]);

      // then
      expect(apdu.getRawApdu()).toEqual(expected);
    });
  });

  describe("parseResponse()", () => {
    it("should return the raw TLV payload on success", () => {
      // given
      const args: ParseBlockHeaderCommandArgs = { header: HEADER_BYTES };
      const cmd = new ParseBlockHeaderCommand(args);
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: TLV_PAYLOAD,
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual(TLV_PAYLOAD);
      }
    });

    it("should map SW errors to CommandResult errors", () => {
      // given
      const args: ParseBlockHeaderCommandArgs = { header: HEADER_BYTES };
      const cmd = new ParseBlockHeaderCommand(args);
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

    it("should handle empty-data payload correctly", () => {
      // given
      const args: ParseBlockHeaderCommandArgs = { header: HEADER_BYTES };
      const cmd = new ParseBlockHeaderCommand(args);
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([]),
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
