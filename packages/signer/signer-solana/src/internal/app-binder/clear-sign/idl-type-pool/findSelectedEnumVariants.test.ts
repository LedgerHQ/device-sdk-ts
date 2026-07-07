import {
  arrayPrefixed,
  bytes,
  concat,
  enumEntry,
  pool,
  struct,
  u32le,
} from "./__tests__/fixtures/builders";
import {
  JUPITER_DATA,
  JUPITER_POOL,
  JUPITER_ROOT,
  JUPITER_SWAP_VARIANT_INDEX,
} from "./__tests__/fixtures/jupiterRoute";
import { findSelectedEnumVariants } from "./findSelectedEnumVariants";
import * as K from "./kinds";
import { parsePool } from "./parsePool";
import { PoolIndexOutOfRangeError } from "./TypePoolDecoderError";
import { type VariantCache } from "./types";

const EMPTY_CACHE: VariantCache = new Map();

describe("findSelectedEnumVariants", () => {
  it("returns the single swap variant selected by the jupiter route", () => {
    const result = findSelectedEnumVariants(
      parsePool(JUPITER_POOL),
      JUPITER_ROOT,
      EMPTY_CACHE,
      JUPITER_DATA,
    );
    expect(result.unsafeCoerce()).toEqual([
      { enumId: "swap", variantIndex: JUPITER_SWAP_VARIANT_INDEX },
    ]);
  });

  it("deduplicates repeated selections while preserving first-seen order", () => {
    // Vec<enum> with 3 elements selecting variants 1, 0, 1.
    const p = pool([
      struct([1]),
      arrayPrefixed(K.KIND_U32, 2),
      enumEntry(K.KIND_U8, 4, "kind"),
    ]);
    const data = concat(u32le(3), bytes(1, 0, 1));
    const result = findSelectedEnumVariants(parsePool(p), 0, EMPTY_CACHE, data);
    expect(result.unsafeCoerce()).toEqual([
      { enumId: "kind", variantIndex: 1 },
      { enumId: "kind", variantIndex: 0 },
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const once = findSelectedEnumVariants(
      parsePool(JUPITER_POOL),
      JUPITER_ROOT,
      EMPTY_CACHE,
      JUPITER_DATA,
    );
    const twice = findSelectedEnumVariants(
      parsePool(JUPITER_POOL),
      JUPITER_ROOT,
      EMPTY_CACHE,
      JUPITER_DATA,
    );
    expect(once.unsafeCoerce()).toEqual(twice.unsafeCoerce());
  });

  it("surfaces malformed input as a typed Left", () => {
    const p = pool([struct([9])]); // out-of-range ref
    const result = findSelectedEnumVariants(
      parsePool(p),
      0,
      EMPTY_CACHE,
      bytes(1),
    );
    expect(result.isLeft()).toBe(true);
    result.ifLeft((e) => expect(e).toBeInstanceOf(PoolIndexOutOfRangeError));
  });
});
