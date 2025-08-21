/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ApduResponse,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import { InitCommand, type InitCommandArgs } from "./InitCommand";

const DUMMY_PUBKEY_HEX = Uint8Array.from([0x02, ...Array(32).fill(0x00)]);
const PLACEHOLDER_BYTES = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);

const makeArgs = (): InitCommandArgs => ({ publicKey: DUMMY_PUBKEY_HEX });

describe("InitCommand", () => {
  describe("getApdu()", () => {
    it("builds correct APDU", () => {
      // given
      const cmd = new InitCommand(makeArgs());

      // when
      const apdu = cmd.getApdu();
      const expected = Uint8Array.from([
        0xe0,
        0x06,
        0x00,
        0x00,
        0x21,
        0x02,
        ...new Array(32).fill(0),
      ]);

      // then
      expect(apdu.getRawApdu()).toEqual(expected);
    });
  });

  describe("parseResponse()", () => {
    it("returns success when no data and SW=0x9000", () => {
      // given
      const cmd = new InitCommand(makeArgs());
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([]),
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toBeUndefined();
      }
    });

    it("errors on unexpected trailing data", () => {
      // given
      const cmd = new InitCommand(makeArgs());
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: PLACEHOLDER_BYTES,
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect((result.error.originalError as Error).message).toMatch(
          "Unexpected response data",
        );
      }
    });

    it("maps SW errors to CommandResult error", () => {
      // given
      const cmd = new InitCommand(makeArgs());
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6a, 0x86]),
        data: new Uint8Array([]),
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        if ("errorCode" in result.error) {
          expect(result.error.errorCode).toEqual("6a86");
        } else {
          throw new Error("Unexpected error type: missing errorCode");
        }
      }
    });
  });
});
