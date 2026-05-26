import { isSuccessCommandResult } from "@ledgerhq/device-management-kit";

import {
  ProvideWeb3CheckCommand,
  TRANSACTION_CHECK_CLA,
  TRANSACTION_CHECK_INS,
  TRANSACTION_CHECK_P1_PROVIDE,
} from "@internal/app-binder/command/ProvideWeb3CheckCommand";
import {
  P2_EXTEND,
  P2_MORE,
} from "@internal/app-binder/command/utils/apduChunking";

describe("ProvideWeb3CheckCommand", () => {
  describe("name", () => {
    it("should be 'provideWeb3Check'", () => {
      const command = new ProvideWeb3CheckCommand({
        payload: new Uint8Array([0xaa]),
        isFirstChunk: true,
        hasMore: false,
      });
      expect(command.name).toBe("provideWeb3Check");
    });
  });

  describe("getApdu", () => {
    const payload = new Uint8Array([0xaa, 0xbb, 0xcc]);

    it("single chunk: P2 = 0x00 (no EXTEND, no MORE)", () => {
      const command = new ProvideWeb3CheckCommand({
        payload,
        isFirstChunk: true,
        hasMore: false,
      });
      const raw = command.getApdu().getRawApdu();

      expect(raw[0]).toBe(TRANSACTION_CHECK_CLA);
      expect(raw[1]).toBe(TRANSACTION_CHECK_INS);
      expect(raw[2]).toBe(TRANSACTION_CHECK_P1_PROVIDE);
      expect(raw[3]).toBe(0x00);
      expect(raw[4]).toBe(payload.length);
      expect(raw.slice(5)).toStrictEqual(payload);
    });

    it("first of many: P2 = P2_MORE", () => {
      const command = new ProvideWeb3CheckCommand({
        payload,
        isFirstChunk: true,
        hasMore: true,
      });
      const raw = command.getApdu().getRawApdu();

      expect(raw[3]).toBe(P2_MORE);
    });

    it("middle chunk: P2 = P2_MORE | P2_EXTEND", () => {
      const command = new ProvideWeb3CheckCommand({
        payload,
        isFirstChunk: false,
        hasMore: true,
      });
      const raw = command.getApdu().getRawApdu();

      expect(raw[3]).toBe(P2_MORE | P2_EXTEND);
    });

    it("last chunk: P2 = P2_EXTEND", () => {
      const command = new ProvideWeb3CheckCommand({
        payload,
        isFirstChunk: false,
        hasMore: false,
      });
      const raw = command.getApdu().getRawApdu();

      expect(raw[3]).toBe(P2_EXTEND);
    });
  });

  describe("parseResponse", () => {
    it("should return success on 0x9000", () => {
      const command = new ProvideWeb3CheckCommand({
        payload: new Uint8Array([0xaa]),
        isFirstChunk: true,
        hasMore: false,
      });
      const result = command.parseResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should return error on non-success status", () => {
      const command = new ProvideWeb3CheckCommand({
        payload: new Uint8Array([0xaa]),
        isFirstChunk: true,
        hasMore: false,
      });
      const result = command.parseResponse({
        statusCode: Uint8Array.from([0x6c, 0xb0]),
        data: new Uint8Array(),
      });
      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
