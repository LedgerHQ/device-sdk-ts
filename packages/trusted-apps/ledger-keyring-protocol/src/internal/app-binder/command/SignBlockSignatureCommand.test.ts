/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import { type SignBlockSignatureCommandResponse } from "@api/app-binder/SignBlockSignatureCommandTypes";

import { SignBlockSignatureCommand } from "./SignBlockSignatureCommand";

const SIG_AND_KEY = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);

describe("SignBlockSignatureCommand", () => {
  describe("getApdu()", () => {
    it("should build the correct APDU for finalize-signature", () => {
      const cmd = new SignBlockSignatureCommand();
      const apdu = cmd.getApdu();
      expect(apdu.getRawApdu()).toEqual(
        Uint8Array.from([0xe0, 0x07, 0x02, 0x00, 0x00]),
      );
    });
  });

  describe("parseResponse()", () => {
    it("should return signature and sessionKey on success", () => {
      // given
      const payload = new Uint8Array([
        SIG_AND_KEY.length,
        ...SIG_AND_KEY,
        SIG_AND_KEY.length,
        ...SIG_AND_KEY,
      ]);
      const cmd = new SignBlockSignatureCommand();
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: payload,
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        const res: SignBlockSignatureCommandResponse = result.data;
        expect(res.signature).toEqual(SIG_AND_KEY);
        expect(res.sessionKey).toEqual(SIG_AND_KEY);
      }
    });

    it("should map SW errors to CommandResult errors", () => {
      // given
      const cmd = new SignBlockSignatureCommand();
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

    it("should error if missing length or reserved byte", () => {
      // given
      const cmd = new SignBlockSignatureCommand();
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect((result.error as any)._tag).toBe("InvalidStatusWordError");
        expect((result.error as any).originalError.message).toBe(
          "Invalid response: missing signature length or reserved byte",
        );
      }
    });

    it("should error if signature length out of bounds", () => {
      // given
      const bad = Uint8Array.from([5, 0xaa, 0xbb]);
      const cmd = new SignBlockSignatureCommand();
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: bad,
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect((result.error as any)._tag).toBe("InvalidStatusWordError");
        expect((result.error as any).originalError.message).toBe(
          "Signature length out of bounds",
        );
      }
    });
  });
});
