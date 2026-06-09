/**
 * The `jupiter.route` worked example: the smallest realistic Jupiter v6 case, a
 * single-step `routePlanStep` whose `swap` enum field holds variant
 * 46 = raydiumCP (empty payload).
 */

import * as K from "@internal/app-binder/clear-sign/idl-type-pool/kinds";

import {
  arrayPrefixed,
  bytes,
  bytesFixed,
  concat,
  enumEntry,
  pool,
  struct,
  u8,
  u16,
  u16le,
  u32le,
  u64,
  u64le,
} from "./builders";

// IDL_TYPE_POOL payload — 8 deduplicated entries.
export const JUPITER_POOL = pool([
  /* 0 */ bytesFixed(8), // discriminator slot (skip leaf)
  /* 1 */ enumEntry(K.KIND_U8, 142, "swap"), // disc=U8 total=142 enum_id="swap"
  /* 2 */ u8(), // reused for percent / inputIndex / outputIndex / platformFeeBps
  /* 3 */ struct([1, 2, 2, 2]), // routePlanStep
  /* 4 */ arrayPrefixed(K.KIND_U32, 3), // Vec<routePlanStep>
  /* 5 */ u64(), // inAmount + quotedOutAmount
  /* 6 */ u16(), // slippageBps
  /* 7 */ struct([0, 4, 5, 5, 6, 2]), // pruned arg-struct of `route`
]);

export const JUPITER_ROOT = 7;

// 8-byte discriminator + arg data.
export const JUPITER_DISCRIMINATOR = bytes(
  0xe5,
  0x17,
  0xcb,
  0x97,
  0x7a,
  0xe3,
  0xad,
  0x2a,
);

export const JUPITER_IN_AMOUNT = 50_000_000_000n;
export const JUPITER_QUOTED_OUT_AMOUNT = 555n;
export const JUPITER_SLIPPAGE_BPS = 10_000;
export const JUPITER_PLATFORM_FEE_BPS = 0;
export const JUPITER_SWAP_VARIANT_INDEX = 46;

export const JUPITER_DATA = concat(
  JUPITER_DISCRIMINATOR, // field 0: BYTES_FIXED(8)
  u32le(1), // field 1: routePlan length = 1
  bytes(JUPITER_SWAP_VARIANT_INDEX, 100, 0, 1), // swap=46, percent=100, in=0, out=1
  u64le(JUPITER_IN_AMOUNT), // field 2: inAmount
  u64le(JUPITER_QUOTED_OUT_AMOUNT), // field 3: quotedOutAmount
  u16le(JUPITER_SLIPPAGE_BPS), // field 4: slippageBps
  bytes(JUPITER_PLATFORM_FEE_BPS), // field 5: platformFeeBps
);
