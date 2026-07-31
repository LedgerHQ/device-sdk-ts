import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { P2_EXTEND, P2_MORE } from "./utils/apduChunking";
import { ChunkTooLargeError } from "./utils/Errors";
import { ProvideTrustedNameCommand } from "./ProvideTrustedNameCommand";

describe("ProvideTrustedNameCommand", () => {
  const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

  describe("name", () => {
    it("should be 'provideTrustedName'", () => {
      const command = new ProvideTrustedNameCommand({
        payload,
        isFirstChunk: true,
        hasMore: false,
      });
      expect(command.name).toBe("provideTrustedName");
    });
  });

  describe("getApdu", () => {
    it("uses CLA=0xE0, INS=0x29, P1=0x00 and carries the payload", () => {
      const apdu = new ProvideTrustedNameCommand({
        payload,
        isFirstChunk: true,
        hasMore: false,
      }).getApdu();

      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x29);
      expect(apdu.p1).toBe(0x00);
      expect(apdu.data).toStrictEqual(payload);
    });

    it("single chunk: P2 = 0x00 (no EXTEND, no MORE)", () => {
      const apdu = new ProvideTrustedNameCommand({
        payload,
        isFirstChunk: true,
        hasMore: false,
      }).getApdu();

      expect(apdu.p2).toBe(0x00);
    });

    it("first of many: P2 = P2_MORE", () => {
      const apdu = new ProvideTrustedNameCommand({
        payload,
        isFirstChunk: true,
        hasMore: true,
      }).getApdu();

      expect(apdu.p2).toBe(P2_MORE);
    });

    it("middle chunk: P2 = P2_MORE | P2_EXTEND", () => {
      const apdu = new ProvideTrustedNameCommand({
        payload,
        isFirstChunk: false,
        hasMore: true,
      }).getApdu();

      expect(apdu.p2).toBe(P2_MORE | P2_EXTEND);
    });

    it("last chunk: P2 = P2_EXTEND", () => {
      const apdu = new ProvideTrustedNameCommand({
        payload,
        isFirstChunk: false,
        hasMore: false,
      }).getApdu();

      expect(apdu.p2).toBe(P2_EXTEND);
    });

    it("defaults the chunking flags to a single-chunk send (P2 = 0x00)", () => {
      const apdu = new ProvideTrustedNameCommand({ payload }).getApdu();

      expect(apdu.p2).toBe(0x00);
    });

    it("throws ChunkTooLargeError if the chunk exceeds APDU_MAX_PAYLOAD", () => {
      const command = new ProvideTrustedNameCommand({
        payload: new Uint8Array(256),
        isFirstChunk: true,
        hasMore: false,
      });

      expect(() => command.getApdu()).toThrow(ChunkTooLargeError);
    });
  });

  describe("parseResponse", () => {
    it("should return success on 0x9000 with empty payload", () => {
      const command = new ProvideTrustedNameCommand({
        payload,
        isFirstChunk: true,
        hasMore: false,
      });
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array(),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should return error on unexpected response data", () => {
      const command = new ProvideTrustedNameCommand({
        payload,
        isFirstChunk: true,
        hasMore: false,
      });
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([0x01]),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return error on non-success status", () => {
      const command = new ProvideTrustedNameCommand({
        payload,
        isFirstChunk: true,
        hasMore: false,
      });
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x6a, 0x80]),
          data: new Uint8Array(),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
