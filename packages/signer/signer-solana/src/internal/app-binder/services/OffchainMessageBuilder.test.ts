import { InvalidStatusWordError } from "@ledgerhq/device-management-kit";

import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";
import {
  MessageFormat,
  OffchainMessageBuilder,
} from "@internal/app-binder/services/OffchainMessageBuilder";

const PUBKEY = new Uint8Array(32).fill(0x11);

describe("OffchainMessageBuilder", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // buildV0
  // ──────────────────────────────────────────────────────────────────────────

  describe("buildV0", () => {
    it("writes signing domain, version 0, appDomain, format, signerCount, pubkey, LE length, body", () => {
      const body = new TextEncoder().encode("AB");
      const builder = new OffchainMessageBuilder();
      const v0 = builder.buildV0(body, PUBKEY);

      expect(v0[0]).toBe(0xff);
      expect(new TextDecoder().decode(v0.slice(1, 16))).toBe("solana offchain");
      expect(v0[16]).toBe(0);
      expect(v0.slice(17, 49)).toEqual(new Uint8Array(32));
      expect(v0[49]).toBe(MessageFormat.Ascii);
      expect(v0[50]).toBe(1);
      expect(v0.slice(51, 83)).toEqual(PUBKEY);
      expect(v0[83]).toBe(body.length & 0xff);
      expect(v0[84]).toBe((body.length >> 8) & 0xff);
      expect(v0.slice(85)).toEqual(body);
    });

    it("encodes appDomain padded to 32 bytes", () => {
      const v0 = new OffchainMessageBuilder("supabase.com").buildV0(
        new Uint8Array([1]),
        PUBKEY,
      );

      const expected = new Uint8Array(32);
      expected.set(new TextEncoder().encode("supabase.com"));
      expect(v0.slice(17, 49)).toEqual(expected);
    });

    it("truncates appDomain longer than 32 bytes", () => {
      const v0 = new OffchainMessageBuilder("a".repeat(50)).buildV0(
        new Uint8Array([1]),
        PUBKEY,
      );

      const expected = new Uint8Array(32);
      expected.set(new TextEncoder().encode("a".repeat(32)));
      expect(v0.slice(17, 49)).toEqual(expected);
    });

    it("detects ASCII format (format=0)", () => {
      const ascii = new TextEncoder().encode("hello\nworld");
      const v0 = new OffchainMessageBuilder().buildV0(ascii, PUBKEY);
      expect(v0[49]).toBe(MessageFormat.Ascii);
    });

    it("detects short UTF-8 format (format=1)", () => {
      const utf8 = new TextEncoder().encode("héllø");
      const v0 = new OffchainMessageBuilder().buildV0(utf8, PUBKEY);
      expect(v0[49]).toBe(MessageFormat.Utf8);
    });

    it("detects long UTF-8 format (format=2)", () => {
      const longUtf8 = new TextEncoder().encode("x".repeat(15313));
      const v0 = new OffchainMessageBuilder().buildV0(longUtf8, PUBKEY);
      expect(v0[49]).toBe(MessageFormat.Utf8LongV0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // buildLegacy
  // ──────────────────────────────────────────────────────────────────────────

  describe("buildLegacy", () => {
    it("omits appDomain, signerCount, and pubkey compared to V0", () => {
      const body = new Uint8Array([1, 2, 3]);
      const builder = new OffchainMessageBuilder("ignored.com");
      const legacy = builder.buildLegacy(body);
      const v0 = builder.buildV0(body, PUBKEY);

      expect(legacy.length).toBe(v0.length - 32 - 1 - 32);
    });

    it("places format byte at offset 17, LE length at 18", () => {
      const body = new TextEncoder().encode("ABC");
      const legacy = new OffchainMessageBuilder().buildLegacy(body);

      expect(legacy[17]).toBe(MessageFormat.Ascii);
      expect(legacy[18]).toBe(3);
      expect(legacy[19]).toBe(0);
    });

    it("forbids newline in ASCII (falls back to UTF-8=1)", () => {
      const withNl = new TextEncoder().encode("hello\nworld");
      const legacy = new OffchainMessageBuilder().buildLegacy(withNl);
      expect(legacy[17]).toBe(MessageFormat.Utf8);
    });

    it("sets format=0 for plain ASCII without newlines", () => {
      const ascii = new TextEncoder().encode("HELLO_123");
      const legacy = new OffchainMessageBuilder().buildLegacy(ascii);
      expect(legacy[17]).toBe(MessageFormat.Ascii);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // buildV1
  // ──────────────────────────────────────────────────────────────────────────

  describe("buildV1", () => {
    it("writes signing domain, version 1, signerCount, pubkey, LE length, body", () => {
      const body = new Uint8Array([0xab, 0xcd]);
      const v1 = new OffchainMessageBuilder().buildV1(body, [PUBKEY]);

      expect(v1[0]).toBe(0xff);
      expect(new TextDecoder().decode(v1.slice(1, 16))).toBe("solana offchain");
      expect(v1[16]).toBe(1);
      expect(v1[17]).toBe(1);
      expect(v1.slice(18, 50)).toEqual(PUBKEY);
      expect(v1[50]).toBe(body.length & 0xff);
      expect(v1[51]).toBe((body.length >> 8) & 0xff);
      expect(v1.slice(52)).toEqual(body);
      expect(v1.length).toBe(16 + 1 + 1 + 32 + 2 + body.length);
    });

    it("accepts message at exactly 65535 bytes (uint16 max)", () => {
      const big = new Uint8Array(65535).fill(0xbb);
      const v1 = new OffchainMessageBuilder().buildV1(big, [PUBKEY]);
      expect(v1.length).toBe(16 + 1 + 1 + 32 + 2 + big.length);
      expect(v1[50]).toBe(0xff);
      expect(v1[51]).toBe(0xff);
    });

    it("does not include appDomain even when provided", () => {
      const body = new Uint8Array([1]);
      const v1 = new OffchainMessageBuilder("should.be.ignored").buildV1(body, [
        PUBKEY,
      ]);

      expect(v1.length).toBe(16 + 1 + 1 + 32 + 2 + body.length);
    });

    it("includes multiple signers sorted and deduplicated", () => {
      const body = new Uint8Array([0xfe]);
      const keyA = new Uint8Array(32).fill(0x01);
      const keyB = new Uint8Array(32).fill(0x02);
      const keyADup = new Uint8Array(32).fill(0x01);

      const v1 = new OffchainMessageBuilder().buildV1(body, [
        keyB,
        keyADup,
        keyA,
      ]);

      expect(v1[17]).toBe(2);
      expect(v1.slice(18, 50)).toEqual(keyA);
      expect(v1.slice(50, 82)).toEqual(keyB);
      expect(v1[82]).toBe(body.length & 0xff);
      expect(v1[83]).toBe((body.length >> 8) & 0xff);
      expect(v1.slice(84)).toEqual(body);
      expect(v1.length).toBe(16 + 1 + 1 + 32 * 2 + 2 + body.length);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // sortAndDedupeSigners
  // ──────────────────────────────────────────────────────────────────────────

  describe("sortAndDedupeSigners", () => {
    const builder = new OffchainMessageBuilder();

    it("sorts keys lexicographically", () => {
      const keyA = new Uint8Array(32).fill(0x01);
      const keyB = new Uint8Array(32).fill(0x02);
      const sorted = builder.sortAndDedupeSigners([keyB, keyA]);

      expect(sorted[0]).toEqual(keyA);
      expect(sorted[1]).toEqual(keyB);
    });

    it("removes duplicates", () => {
      const key = new Uint8Array(32).fill(0x01);
      const dup = new Uint8Array(32).fill(0x01);
      const sorted = builder.sortAndDedupeSigners([key, dup]);

      expect(sorted).toHaveLength(1);
    });

    it("sorts by first differing byte", () => {
      const keyA = new Uint8Array(32).fill(0x00);
      keyA[31] = 0x01;
      const keyB = new Uint8Array(32).fill(0x00);
      keyB[0] = 0x01;

      const sorted = builder.sortAndDedupeSigners([keyA, keyB]);
      expect(sorted[0]).toEqual(keyA);
      expect(sorted[1]).toEqual(keyB);
    });

    it("handles sort + dedup together", () => {
      const keyA = new Uint8Array(32).fill(0x01);
      const keyB = new Uint8Array(32).fill(0x02);
      const keyADup = new Uint8Array(32).fill(0x01);
      const sorted = builder.sortAndDedupeSigners([keyB, keyADup, keyA]);

      expect(sorted).toHaveLength(2);
      expect(sorted[0]).toEqual(keyA);
      expect(sorted[1]).toEqual(keyB);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // buildApduPayload
  // ──────────────────────────────────────────────────────────────────────────

  describe("buildApduPayload", () => {
    it("prepends signerCount + derivationCount + paths, then appends message", () => {
      const msg = new Uint8Array([0xaa, 0xbb]);
      const paths = [44 | 0x80000000, 501 | 0x80000000, 0 | 0x80000000, 0];
      const apdu = new OffchainMessageBuilder().buildApduPayload(msg, paths);

      expect(apdu[0]).toBe(1);
      expect(apdu[1]).toBe(paths.length);
      expect(apdu.slice(apdu.length - msg.length)).toEqual(msg);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // buildEnvelopeBase58
  // ──────────────────────────────────────────────────────────────────────────

  describe("buildEnvelopeBase58", () => {
    it("wraps [sigCount=1][sig(64)][OCM] and encodes as base58", () => {
      const sig = new Uint8Array(64).fill(0x33);
      const ocm = new Uint8Array([0x01, 0x02]);
      const b58 = new OffchainMessageBuilder().buildEnvelopeBase58(sig, ocm);

      const decoded = DefaultBs58Encoder.decode(b58);
      expect(decoded[0]).toBe(1);
      expect(decoded.slice(1, 65)).toEqual(sig);
      expect(decoded.slice(65)).toEqual(ocm);
    });

    it("throws on non-64-byte signature", () => {
      const badSig = new Uint8Array(32);
      const ocm = new Uint8Array([1]);

      expect(() =>
        new OffchainMessageBuilder().buildEnvelopeBase58(badSig, ocm),
      ).toThrow(InvalidStatusWordError);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findMessageFormat
  // ──────────────────────────────────────────────────────────────────────────

  describe("findMessageFormat", () => {
    const builder = new OffchainMessageBuilder();

    it("returns Ascii for printable ASCII (non-legacy allows newline)", () => {
      const msg = new TextEncoder().encode("hello\nworld");
      expect(builder.findMessageFormat(msg, false)).toBe(MessageFormat.Ascii);
    });

    it("returns Utf8 for short non-ASCII UTF-8", () => {
      const msg = new TextEncoder().encode("héllø");
      expect(builder.findMessageFormat(msg, false)).toBe(MessageFormat.Utf8);
    });

    it("returns Utf8LongV0 for long UTF-8", () => {
      const msg = new TextEncoder().encode("x".repeat(15313));
      expect(builder.findMessageFormat(msg, false)).toBe(
        MessageFormat.Utf8LongV0,
      );
    });

    it("legacy forbids newline in ASCII (falls back to UTF-8)", () => {
      const msg = new TextEncoder().encode("hello\nworld");
      expect(builder.findMessageFormat(msg, true)).toBe(MessageFormat.Utf8);
    });

    it("throws on non-ASCII non-UTF8 content", () => {
      const bad = new Uint8Array([0xff, 0xfe]);
      expect(() => builder.findMessageFormat(bad, false)).toThrow(
        InvalidStatusWordError,
      );
    });

    it("throws on oversized message", () => {
      const big = new Uint8Array(65516).fill(0x41);
      expect(() => builder.findMessageFormat(big, false)).toThrow(
        InvalidStatusWordError,
      );
    });
  });
});
