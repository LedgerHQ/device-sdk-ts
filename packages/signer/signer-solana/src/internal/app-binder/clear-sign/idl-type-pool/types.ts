import {
  type VARIANT_PAYLOAD_EMPTY,
  type VARIANT_PAYLOAD_INLINE,
  type VARIANT_PAYLOAD_RAW_SIZE,
} from "./kinds";

/**
 * A `ref` slot in a parsed {@link Entry}: a numeric `u8` pool index for pool
 * entries, or a nested {@link Entry} for inline ENUM_VARIANT payloads (which
 * inline their descriptors instead of referencing the pool).
 */
export type Ref = number | Entry;

/** Parsed view of a single type-pool entry (or inline variant payload). */
export type Entry = {
  kind: number;
  refs: Ref[];
  fixedSize?: number;
  encoding?: number;
  lenKind?: number;
  flagKind?: number;
  sentinel?: Uint8Array;
  discKind?: number;
  totalVariants?: number;
  enumId?: string;
};

export type LeafValue = number | bigint | boolean | string | Uint8Array;

/** A `(packedArgumentPath, value)` leaf emitted during a decode. */
export type Leaf = {
  /** Packed argument path: `u8 step_count || <packed kind-aware steps>`. */
  path: Uint8Array;
  value: LeafValue;
};

/** An `(enumId, variantIndex)` pair the instruction data selected. */
export type SelectedEnumVariant = {
  enumId: string;
  variantIndex: number;
};

export type DecodeResult = {
  leaves: Leaf[];
  /** Selected variants in the order decoded; deduplication is the caller's concern. */
  selectedEnumVariants: SelectedEnumVariant[];
  /** Compare to `data.length` to detect under-/over-consumption. */
  cursorEnd: number;
};

/**
 * Decoded `ENUM_VARIANT` payload metadata:
 * - `EMPTY`: no payload bytes follow the discriminator.
 * - `INLINE`: payload is a parsed inline {@link Entry} the decoder recurses into.
 * - `RAW_SIZE`: payload is an opaque byte count the decoder skips.
 */
export type VariantPayload =
  | { kind: typeof VARIANT_PAYLOAD_EMPTY }
  | { kind: typeof VARIANT_PAYLOAD_INLINE; payload: Entry }
  | { kind: typeof VARIANT_PAYLOAD_RAW_SIZE; size: number };

export type CachedVariant = {
  variantName: string;
} & VariantPayload;

/** Keyed by {@link variantCacheKey} so lookups stay O(1) without a tuple key. */
export type VariantCache = ReadonlyMap<string, CachedVariant>;

export function variantCacheKey(enumId: string, variantIndex: number): string {
  return `${enumId}:${variantIndex}`;
}
