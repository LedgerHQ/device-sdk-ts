import { APDU_MAX_PAYLOAD } from "@ledgerhq/device-management-kit";

import {
  appendSignatureTlv,
  assertChunkSize,
  buildChunkP2,
  CLEAR_SIGN_SIGNATURE_TAG,
  P2_EXTEND,
  P2_MORE,
} from "./apduChunking";
import { ChunkTooLargeError } from "./Errors";

describe("apduChunking", () => {
  describe("constants", () => {
    it("matches the Solana chunking convention", () => {
      expect(P2_EXTEND).toBe(0x01);
      expect(P2_MORE).toBe(0x02);
    });
  });

  describe("buildChunkP2", () => {
    it("returns 0x00 for a single chunk (first=true, more=false)", () => {
      expect(buildChunkP2(true, false)).toBe(0x00);
    });

    it("returns P2_MORE for the first of many (first=true, more=true)", () => {
      expect(buildChunkP2(true, true)).toBe(P2_MORE);
    });

    it("returns P2_MORE | P2_EXTEND for a middle chunk (first=false, more=true)", () => {
      expect(buildChunkP2(false, true)).toBe(P2_MORE | P2_EXTEND);
    });

    it("returns P2_EXTEND for the last chunk (first=false, more=false)", () => {
      expect(buildChunkP2(false, false)).toBe(P2_EXTEND);
    });
  });

  describe("assertChunkSize", () => {
    it("accepts an empty payload", () => {
      expect(() => assertChunkSize(new Uint8Array(), 0x24)).not.toThrow();
    });

    it("accepts a payload of exactly APDU_MAX_PAYLOAD bytes", () => {
      expect(() =>
        assertChunkSize(new Uint8Array(APDU_MAX_PAYLOAD), 0x24),
      ).not.toThrow();
    });

    it("throws ChunkTooLargeError when the payload exceeds APDU_MAX_PAYLOAD", () => {
      expect(() =>
        assertChunkSize(new Uint8Array(APDU_MAX_PAYLOAD + 1), 0x24),
      ).toThrow(ChunkTooLargeError);
    });

    it("includes the INS byte in the error message for debuggability", () => {
      expect(() => assertChunkSize(new Uint8Array(300), 0x25)).toThrow(
        /INS=0x25/,
      );
      expect(() => assertChunkSize(new Uint8Array(300), 0x0a)).toThrow(
        /INS=0x0a/,
      );
    });

    it("includes the actual and max sizes in the error message", () => {
      expect(() => assertChunkSize(new Uint8Array(300), 0x24)).toThrow(
        new RegExp(`300 > ${APDU_MAX_PAYLOAD}`),
      );
    });

    it("ChunkTooLargeError carries the payload size, INS, and DmkError _tag", () => {
      try {
        assertChunkSize(new Uint8Array(300), 0x25);
        throw new Error("expected to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(ChunkTooLargeError);
        expect(err).toBeInstanceOf(Error);
        const e = err as ChunkTooLargeError;
        expect(e.payloadSize).toBe(300);
        expect(e.ins).toBe(0x25);
        expect(e._tag).toBe("ChunkTooLargeError");
        expect(e.message).toMatch(/INS=0x25/);
      }
    });
  });

  describe("appendSignatureTlv", () => {
    it("appends a DER short-form SIGNATURE (0x15) record after the TLV", () => {
      const signed = appendSignatureTlv(
        new Uint8Array([0xaa, 0xbb]),
        new Uint8Array([0xcc, 0xdd]),
      );
      expect(signed).toStrictEqual(
        new Uint8Array([
          0xaa,
          0xbb,
          CLEAR_SIGN_SIGNATURE_TAG,
          0x02,
          0xcc,
          0xdd,
        ]),
      );
    });

    it("encodes a realistic 72-byte DER signature with a short-form length", () => {
      const signature = new Uint8Array(72).fill(0x11);
      const signed = appendSignatureTlv(new Uint8Array([0xaa]), signature);
      expect(signed[1]).toBe(CLEAR_SIGN_SIGNATURE_TAG);
      expect(signed[2]).toBe(72); // < 0x80, single length byte
      expect(signed.length).toBe(1 + 2 + 72);
    });

    it("uses DER long-form length for payloads of 0x80 bytes or more", () => {
      const signature = new Uint8Array(0x80).fill(0x11);
      const signed = appendSignatureTlv(new Uint8Array([]), signature);
      // tag, 0x81 (long-form, 1 length byte), 0x80, then the value
      expect(signed[0]).toBe(CLEAR_SIGN_SIGNATURE_TAG);
      expect(signed[1]).toBe(0x81);
      expect(signed[2]).toBe(0x80);
      expect(signed.length).toBe(1 + 2 + 0x80);
    });
  });
});
