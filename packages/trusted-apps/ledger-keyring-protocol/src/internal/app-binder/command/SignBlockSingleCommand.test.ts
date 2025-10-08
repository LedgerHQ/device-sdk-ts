/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import {
  SignBlockSingleCommand,
  type SignBlockSingleCommandArgs,
  type SignBlockSingleCommandResponse,
} from "./SignBlockSingleCommand";

const COMMAND_BYTES = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);
const TLV_PAYLOAD = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);

describe("SignBlockSingleCommand", () => {
  describe("getApdu()", () => {
    it("should build the correct APDU for a given command", () => {
      // given
      const args: SignBlockSingleCommandArgs = { command: COMMAND_BYTES };
      const cmd = new SignBlockSingleCommand(args);

      // when
      const apdu = cmd.getApdu();
      const expected = Uint8Array.from([
        0xe0,
        0x07,
        0x01,
        0x00,
        COMMAND_BYTES.length,
        ...COMMAND_BYTES,
      ]);

      // then
      expect(apdu.getRawApdu()).toEqual(expected);
    });
  });

  describe("parseResponse()", () => {
    it("should return the raw TLV blob on success", () => {
      // given
      const args: SignBlockSingleCommandArgs = { command: COMMAND_BYTES };
      const cmd = new SignBlockSingleCommand(args);
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: TLV_PAYLOAD,
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        const data: SignBlockSingleCommandResponse = result.data;
        expect(data).toEqual(TLV_PAYLOAD);
      }
    });

    it("should map SW errors to CommandResult errors", () => {
      // given
      const args: SignBlockSingleCommandArgs = { command: COMMAND_BYTES };
      const cmd = new SignBlockSingleCommand(args);
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

    it("should return an empty Uint8Array if no data is returned", () => {
      // given
      const args: SignBlockSingleCommandArgs = { command: COMMAND_BYTES };
      const cmd = new SignBlockSingleCommand(args);
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual(new Uint8Array());
      }
    });
  });
});
