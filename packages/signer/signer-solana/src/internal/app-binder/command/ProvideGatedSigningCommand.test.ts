import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { P2_EXTEND, P2_MORE } from "./utils/apduChunking";
import { ChunkTooLargeError } from "./utils/Errors";
import { ProvideGatedSigningCommand } from "./ProvideGatedSigningCommand";

describe("ProvideGatedSigningCommand", () => {
  const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

  it("is named 'provideGatedSigning'", () => {
    expect(new ProvideGatedSigningCommand({ payload }).name).toBe(
      "provideGatedSigning",
    );
  });

  describe("getApdu", () => {
    it("uses CLA=0xE0, INS=0x2A, P1=0x00 and carries the payload", () => {
      const apdu = new ProvideGatedSigningCommand({ payload }).getApdu();

      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x2a);
      expect(apdu.p1).toBe(0x00);
      expect(apdu.data).toStrictEqual(payload);
    });

    it.each([
      ["single chunk", true, false, 0x00],
      ["first of many", true, true, P2_MORE],
      ["middle chunk", false, true, P2_MORE | P2_EXTEND],
      ["last chunk", false, false, P2_EXTEND],
    ])("%s: P2 = %#x", (_, isFirstChunk, hasMore, p2) => {
      const apdu = new ProvideGatedSigningCommand({
        payload,
        isFirstChunk,
        hasMore,
      }).getApdu();

      expect(apdu.p2).toBe(p2);
    });

    it("throws ChunkTooLargeError if the chunk exceeds APDU_MAX_PAYLOAD", () => {
      const command = new ProvideGatedSigningCommand({
        payload: new Uint8Array(256),
      });

      expect(() => command.getApdu()).toThrow(ChunkTooLargeError);
    });
  });

  describe("parseResponse", () => {
    const command = new ProvideGatedSigningCommand({ payload });

    it("succeeds on 0x9000 with an empty payload", () => {
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array(),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("fails on unexpected response data", () => {
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([0x01]),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("fails on a non-success status", () => {
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x6d, 0x00]),
          data: new Uint8Array(),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
