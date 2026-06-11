import {
  bytes,
  enumVariantTlv,
  rawSizePayload,
} from "./__tests__/fixtures/builders";
import { buildEnumCache } from "./buildEnumCache";
import * as K from "./kinds";
import { TruncatedDataError } from "./TypePoolDecoderError";
import { variantCacheKey } from "./types";

describe("buildEnumCache", () => {
  it("builds EMPTY / INLINE / RAW_SIZE variants from ENUM_VARIANT TLVs", () => {
    const inline = bytes(K.KIND_STRUCT, 1, K.KIND_U8);
    const result = buildEnumCache([
      enumVariantTlv({
        enumId: "swap",
        variantIndex: 46,
        variantName: "raydiumCP",
        payloadKind: K.VARIANT_PAYLOAD_EMPTY,
      }),
      enumVariantTlv({
        enumId: "action",
        variantIndex: 1,
        variantName: "deposit",
        payloadKind: K.VARIANT_PAYLOAD_INLINE,
        payload: inline,
      }),
      enumVariantTlv({
        enumId: "action",
        variantIndex: 2,
        variantName: "raw",
        payloadKind: K.VARIANT_PAYLOAD_RAW_SIZE,
        payload: rawSizePayload(8),
      }),
    ]);

    expect(result.isRight()).toBe(true);
    const cache = result.unsafeCoerce();
    expect(cache.get(variantCacheKey("swap", 46))).toMatchObject({
      variantName: "raydiumCP",
      kind: K.VARIANT_PAYLOAD_EMPTY,
    });
    expect(cache.get(variantCacheKey("action", 1))).toMatchObject({
      variantName: "deposit",
      kind: K.VARIANT_PAYLOAD_INLINE,
    });
    expect(cache.get(variantCacheKey("action", 2))).toMatchObject({
      variantName: "raw",
      kind: K.VARIANT_PAYLOAD_RAW_SIZE,
      size: 8,
    });
  });

  it("skips semantically-incomplete records (missing mandatory tags)", () => {
    const result = buildEnumCache([
      enumVariantTlv({
        enumId: "x",
        variantIndex: 0,
        variantName: "ok",
        payloadKind: K.VARIANT_PAYLOAD_EMPTY,
      }),
      enumVariantTlv({
        enumId: "x",
        variantIndex: 1,
        variantName: "missingKind",
        payloadKind: K.VARIANT_PAYLOAD_EMPTY,
        omit: ["payloadKind"],
      }),
    ]);
    const cache = result.unsafeCoerce();
    expect(cache.has(variantCacheKey("x", 0))).toBe(true);
    expect(cache.has(variantCacheKey("x", 1))).toBe(false);
  });

  it("returns a typed error for structurally-truncated TLV framing", () => {
    // tag present, DER length claims 5 bytes but the value is missing.
    const truncated = bytes(0x23, 0x05, 0x68, 0x69);
    const result = buildEnumCache([truncated]);
    expect(result.isLeft()).toBe(true);
    result.ifLeft((e) => expect(e).toBeInstanceOf(TruncatedDataError));
  });

  it("is deterministic: later duplicates win", () => {
    const result = buildEnumCache([
      enumVariantTlv({
        enumId: "e",
        variantIndex: 0,
        variantName: "first",
        payloadKind: K.VARIANT_PAYLOAD_EMPTY,
      }),
      enumVariantTlv({
        enumId: "e",
        variantIndex: 0,
        variantName: "second",
        payloadKind: K.VARIANT_PAYLOAD_EMPTY,
      }),
    ]);
    expect(
      result.unsafeCoerce().get(variantCacheKey("e", 0))?.variantName,
    ).toBe("second");
  });
});
