import {
  ApduResponse,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import type { SetTrustedMemberCommandArgs } from "@api/app-binder/SetTrustedMemberTypes";

import { SetTrustedMemberCommand } from "./SetTrustedMemberCommand";

const PLACEHOLDER_BYTES = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);

describe("SetTrustedMemberCommand", () => {
  const makeArgs = (): SetTrustedMemberCommandArgs => ({
    iv: PLACEHOLDER_BYTES,
    memberTlv: PLACEHOLDER_BYTES,
  });

  describe("getApdu()", () => {
    it("builds correct APDU", () => {
      // given
      const cmd = new SetTrustedMemberCommand(makeArgs());

      // when
      const apdu = cmd.getApdu();
      const expected = Uint8Array.from(
        [
          [0xe0, 0x09, 0x00, 0x00, 0x0a], // CLA, INS, P1, P2, Lc
          [0x00, 0x04, 0xf0, 0xca, 0xcc, 0x1a], // IV
          [0xf0, 0xca, 0xcc, 0x1a], // Member
        ].flat(),
      );

      // then
      expect(apdu.getRawApdu()).toEqual(expected);
    });
  });

  describe("parseResponse()", () => {
    it("returns success when no data and SW=0x9000", () => {
      // given
      const cmd = new SetTrustedMemberCommand(makeArgs());
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([]),
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual(undefined);
      }
    });

    it("returns error on unexpected trailing data", () => {
      // given
      const cmd = new SetTrustedMemberCommand(makeArgs());
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x01, 0x02]),
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect((result.error.originalError as Error)?.message).toMatch(
          "Unexpected response data",
        );
      }
    });

    it("maps SW errors to CommandResult error", () => {
      // given
      const cmd = new SetTrustedMemberCommand(makeArgs());
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
          throw new Error(
            "Unexpected error type: errorCode property is missing",
          );
        }
      }
    });
  });
});
