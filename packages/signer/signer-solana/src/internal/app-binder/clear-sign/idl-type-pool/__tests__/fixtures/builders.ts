/**
 * Byte-level builders for `IDL_TYPE_POOL` entries, `ENUM_VARIANT` TLVs and raw
 * instruction data. Deliberately dumb so the tests pin the exact on-wire bytes
 * the device would receive.
 */

import * as K from "@internal/app-binder/clear-sign/idl-type-pool/kinds";

export function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const u16be = (n: number): Uint8Array => bytes((n >> 8) & 0xff, n & 0xff);

// ---- pool entry builders (return the encoded bytes of one entry) ----------

export const primitive = (kind: number): Uint8Array => bytes(kind);
export const u8 = (): Uint8Array => bytes(K.KIND_U8);
export const u16 = (): Uint8Array => bytes(K.KIND_U16);
export const u32 = (): Uint8Array => bytes(K.KIND_U32);
export const u64 = (): Uint8Array => bytes(K.KIND_U64);
export const pubkey = (): Uint8Array => bytes(K.KIND_PUBKEY_32);
export const bytesRemainder = (): Uint8Array => bytes(K.KIND_BYTES_REMAINDER);

export const bytesFixed = (size: number): Uint8Array =>
  concat(bytes(K.KIND_BYTES_FIXED), u16be(size));

export const stringFixed = (
  size: number,
  encoding = K.ENCODING_UTF8,
): Uint8Array =>
  concat(bytes(K.KIND_STRING_FIXED), u16be(size), bytes(encoding));

export const stringPrefixed = (
  lenKind: number,
  encoding = K.ENCODING_UTF8,
): Uint8Array => bytes(K.KIND_STRING_PREFIXED, lenKind, encoding);

export const struct = (refs: number[]): Uint8Array =>
  bytes(K.KIND_STRUCT, refs.length, ...refs);

export const tuple = (refs: number[]): Uint8Array =>
  bytes(K.KIND_TUPLE, refs.length, ...refs);

export const optionDynamic = (flagKind: number, innerRef: number): Uint8Array =>
  bytes(K.KIND_OPTION_DYNAMIC, flagKind, innerRef);

export const optionFixed = (flagKind: number, innerRef: number): Uint8Array =>
  bytes(K.KIND_OPTION_FIXED, flagKind, innerRef);

export const optionZeroable = (
  innerRef: number,
  sentinel: Uint8Array,
): Uint8Array =>
  concat(bytes(K.KIND_OPTION_ZEROABLE, innerRef, sentinel.length), sentinel);

export const optionRemainder = (innerRef: number): Uint8Array =>
  bytes(K.KIND_OPTION_REMAINDER, innerRef);

export const arrayFixed = (count: number, itemRef: number): Uint8Array =>
  concat(bytes(K.KIND_ARRAY_FIXED), u16be(count), bytes(itemRef));

export const arrayPrefixed = (lenKind: number, itemRef: number): Uint8Array =>
  bytes(K.KIND_ARRAY_PREFIXED, lenKind, itemRef);

export const arrayRemainder = (itemRef: number): Uint8Array =>
  bytes(K.KIND_ARRAY_REMAINDER, itemRef);

export const enumEntry = (
  discKind: number,
  totalVariants: number,
  enumId: string,
): Uint8Array => {
  const id = new TextEncoder().encode(enumId);
  return concat(
    bytes(K.KIND_ENUM, discKind),
    u16be(totalVariants),
    bytes(id.length),
    id,
  );
};

export const hiddenPrefix = (skipRef: number, innerRef: number): Uint8Array =>
  bytes(K.KIND_HIDDEN_PREFIX, skipRef, innerRef);

export const hiddenSuffix = (skipRef: number, innerRef: number): Uint8Array =>
  bytes(K.KIND_HIDDEN_SUFFIX, skipRef, innerRef);

/** Assemble a full `IDL_TYPE_POOL` value: `u8 count || entries…`. */
export const pool = (entries: Uint8Array[]): Uint8Array =>
  concat(bytes(entries.length), ...entries);

// ---- ENUM_VARIANT TLV builder ---------------------------------------------

const TAG_EV_ENUM_ID = 0x21;
const TAG_EV_VARIANT_INDEX = 0x22;
const TAG_EV_VARIANT_NAME = 0x23;
const TAG_EV_PAYLOAD_KIND = 0x24;
const TAG_EV_PAYLOAD = 0x25;

function derLength(length: number): Uint8Array {
  if (length < 0x80) return bytes(length);
  if (length <= 0xff) return bytes(0x81, length);
  return bytes(0x82, (length >> 8) & 0xff, length & 0xff);
}

function tlv(tag: number, value: Uint8Array): Uint8Array {
  return concat(bytes(tag), derLength(value.length), value);
}

export type VariantTlvSpec = {
  enumId: string;
  variantIndex: number;
  variantName: string;
  /** EMPTY (0x00), INLINE (0x02) or RAW_SIZE (0x03). */
  payloadKind: number;
  /** For INLINE: the inline descriptor bytes. For RAW_SIZE: u16be size. */
  payload?: Uint8Array;
  /** Drop the given tag from the record (to test lenient skipping). */
  omit?: ("enumId" | "variantIndex" | "payloadKind")[];
};

/** Build one `ENUM_VARIANT` TLV value carrying only the tags the cache reads. */
export function enumVariantTlv(spec: VariantTlvSpec): Uint8Array {
  const omit = new Set(spec.omit ?? []);
  const records: Uint8Array[] = [];
  if (!omit.has("enumId")) {
    records.push(tlv(TAG_EV_ENUM_ID, new TextEncoder().encode(spec.enumId)));
  }
  if (!omit.has("variantIndex")) {
    records.push(tlv(TAG_EV_VARIANT_INDEX, u16be(spec.variantIndex)));
  }
  records.push(
    tlv(TAG_EV_VARIANT_NAME, new TextEncoder().encode(spec.variantName)),
  );
  if (!omit.has("payloadKind")) {
    records.push(tlv(TAG_EV_PAYLOAD_KIND, bytes(spec.payloadKind)));
  }
  if (spec.payload !== undefined) {
    records.push(tlv(TAG_EV_PAYLOAD, spec.payload));
  }
  return concat(...records);
}

/** Encode a RAW_SIZE payload (`u16be` byte count). */
export const rawSizePayload = (size: number): Uint8Array => u16be(size);

// ---- instruction-data builders --------------------------------------------

export const u32le = (n: number): Uint8Array =>
  bytes(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);

export const u16le = (n: number): Uint8Array =>
  bytes(n & 0xff, (n >> 8) & 0xff);

export const u64le = (n: bigint): Uint8Array => {
  const out = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
};
