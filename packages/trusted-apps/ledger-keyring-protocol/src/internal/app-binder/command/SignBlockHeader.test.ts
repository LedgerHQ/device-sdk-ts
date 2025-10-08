/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import { GeneralTags } from "@internal/models/Tags";

import {
  ISSUER_PLACEHOLDER_TLV,
  SignBlockHeaderCommand,
  type SignBlockHeaderCommandArgs,
  type SignBlockHeaderCommandResponse,
} from "./SignBlockHeader";

const COMMAND_COUNT = 3;
const PARENT_BYTES = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);
const HEADER_BYTES = Uint8Array.from([
  ...[GeneralTags.Int, 1, 1], // version 1
  ...[GeneralTags.Hash, 4, ...PARENT_BYTES], // Parent hash
  ...ISSUER_PLACEHOLDER_TLV,
  ...[GeneralTags.Int, 1, COMMAND_COUNT], // command count
]);
const TLV_VALUE = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);
const IV_TLV = Uint8Array.from([0x00, TLV_VALUE.length, ...TLV_VALUE]);
const ISSUER_TLV = Uint8Array.from([0x81, TLV_VALUE.length, ...TLV_VALUE]);
const FULL_TLV_PAYLOAD = new Uint8Array([...IV_TLV, ...ISSUER_TLV]);

describe("SignBlockHeaderCommand", () => {
  describe("getApdu()", () => {
    it("should build the correct APDU for a parent hash and a commands count", () => {
      // given
      const args: SignBlockHeaderCommandArgs = {
        parent: PARENT_BYTES,
        commandCount: COMMAND_COUNT,
      };
      const cmd = new SignBlockHeaderCommand(args);

      // when
      const apdu = cmd.getApdu();
      const expected = Uint8Array.from([
        0xe0,
        0x07,
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
    it("should return raw payload on success", () => {
      // given
      const args: SignBlockHeaderCommandArgs = {
        parent: PARENT_BYTES,
        commandCount: COMMAND_COUNT,
      };
      const cmd = new SignBlockHeaderCommand(args);
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: FULL_TLV_PAYLOAD,
      });

      // when
      const result = cmd.parseResponse(response);

      // then
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        const res: SignBlockHeaderCommandResponse = result.data;
        expect(res).toEqual(FULL_TLV_PAYLOAD);
      }
    });

    it("should map SW errors to CommandResult errors", () => {
      // given
      const args: SignBlockHeaderCommandArgs = {
        parent: PARENT_BYTES,
        commandCount: COMMAND_COUNT,
      };
      const cmd = new SignBlockHeaderCommand(args);
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

    it("should error if no data is returned", () => {
      // given
      const args: SignBlockHeaderCommandArgs = {
        parent: PARENT_BYTES,
        commandCount: COMMAND_COUNT,
      };
      const cmd = new SignBlockHeaderCommand(args);
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
