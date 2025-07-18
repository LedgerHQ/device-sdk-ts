/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import type { ParseSingleCommandArgs } from "@api/app-binder/ParseStreamBlockCommandCommandTypes";

import { ParseSingleCommand } from "./ParseStreamBlockCommand";

const DUMMY_COMMAND = Uint8Array.from([0x01, 0x02, 0x03]);
const PLACEHOLDER_BYTES = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);

describe("ParseSingleCommand", () => {
  const makeArgs = (outputTrustedParam = false): ParseSingleCommandArgs => ({
    command: DUMMY_COMMAND,
    outputTrustedParam,
  });

  describe("getApdu()", () => {
    it("builds correct APDU without trustedParam", () => {
      // given
      const cmd = new ParseSingleCommand(makeArgs(false));

      // when
      const apdu = cmd.getApdu();
      const raw = apdu.getRawApdu();

      // then
      expect(raw).toEqual(
        Uint8Array.from([
          0xe0,
          0x08,
          0x01,
          0x00,
          DUMMY_COMMAND.length,
          ...DUMMY_COMMAND,
        ]),
      );
    });

    it("builds correct APDU with trustedParam", () => {
      // given
      const cmd = new ParseSingleCommand(makeArgs(true));

      // when
      const apdu = cmd.getApdu();
      const raw = apdu.getRawApdu();

      // then
      expect(raw).toEqual(
        Uint8Array.from([
          0xe0,
          0x08,
          0x01,
          0x01,
          DUMMY_COMMAND.length,
          ...DUMMY_COMMAND,
        ]),
      );
    });
  });

  describe("parseResponse()", () => {
    it("returns raw TLV payload on success", () => {
      // given
      const cmd = new ParseSingleCommand(makeArgs());
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
      const cmd = new ParseSingleCommand(makeArgs());
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
      const cmd = new ParseSingleCommand(makeArgs());
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
