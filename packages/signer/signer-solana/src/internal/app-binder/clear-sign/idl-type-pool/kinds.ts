// Type-pool kind codes: the leading byte of every IDL_TYPE_POOL entry, also
// reused inline as `*_kind` markers (e.g. ENUM.discKind, ARRAY_PREFIXED.lenKind).

export const KIND_U8 = 0x01;
export const KIND_U16 = 0x02;
export const KIND_U32 = 0x03;
export const KIND_U64 = 0x04;
export const KIND_U128 = 0x05;
export const KIND_I8 = 0x06;
export const KIND_I16 = 0x07;
export const KIND_I32 = 0x08;
export const KIND_I64 = 0x09;
export const KIND_I128 = 0x0a;
export const KIND_F32 = 0x0b;
export const KIND_F64 = 0x0c;
export const KIND_SHORT_U16 = 0x0d;
export const KIND_BOOL_U8 = 0x0e;
export const KIND_BOOL_U16 = 0x0f;
export const KIND_BOOL_U32 = 0x10;
export const KIND_PUBKEY_32 = 0x11;
export const KIND_BYTES_FIXED = 0x12;
export const KIND_STRING_FIXED = 0x13;
export const KIND_STRING_PREFIXED = 0x14;
export const KIND_BYTES_REMAINDER = 0x15;

export const KIND_STRUCT = 0x20;
export const KIND_TUPLE = 0x21;
export const KIND_OPTION_DYNAMIC = 0x22;
export const KIND_OPTION_FIXED = 0x23;
export const KIND_OPTION_ZEROABLE = 0x24;
export const KIND_ARRAY_FIXED = 0x25;
export const KIND_ARRAY_PREFIXED = 0x26;
export const KIND_ARRAY_REMAINDER = 0x27;
export const KIND_ENUM = 0x28;
export const KIND_HIDDEN_PREFIX = 0x29;
export const KIND_HIDDEN_SUFFIX = 0x2a;
export const KIND_OPTION_REMAINDER = 0x2b;

export const ENCODING_UTF8 = 0x00;
export const ENCODING_BASE16 = 0x01;

export const VARIANT_PAYLOAD_EMPTY = 0x00;
export const VARIANT_PAYLOAD_INLINE = 0x02;
export const VARIANT_PAYLOAD_RAW_SIZE = 0x03;

// SHORT_U16 is intentionally absent: it is a 1–3 byte varint, not fixed-width.
export const PRIMITIVE_KIND_BYTE_SIZES: ReadonlyMap<number, number> = new Map([
  [KIND_U8, 1],
  [KIND_U16, 2],
  [KIND_U32, 4],
  [KIND_U64, 8],
  [KIND_U128, 16],
  [KIND_I8, 1],
  [KIND_I16, 2],
  [KIND_I32, 4],
  [KIND_I64, 8],
  [KIND_I128, 16],
  [KIND_F32, 4],
  [KIND_F64, 8],
  [KIND_BOOL_U8, 1],
  [KIND_BOOL_U16, 2],
  [KIND_BOOL_U32, 4],
  [KIND_PUBKEY_32, 32],
]);

/** Kinds the decoder treats as scalar leaves (no recursion, single value). */
export const PRIMITIVE_KINDS: ReadonlySet<number> = new Set([
  KIND_U8,
  KIND_U16,
  KIND_U32,
  KIND_U64,
  KIND_U128,
  KIND_I8,
  KIND_I16,
  KIND_I32,
  KIND_I64,
  KIND_I128,
  KIND_F32,
  KIND_F64,
  KIND_SHORT_U16,
  KIND_BOOL_U8,
  KIND_BOOL_U16,
  KIND_BOOL_U32,
  KIND_PUBKEY_32,
]);

/** Unsigned integer kinds that `readUnsigned` accepts (excludes SHORT_U16). */
export const UNSIGNED_INT_KINDS: ReadonlySet<number> = new Set([
  KIND_U8,
  KIND_U16,
  KIND_U32,
  KIND_U64,
  KIND_U128,
  KIND_BOOL_U8,
  KIND_BOOL_U16,
  KIND_BOOL_U32,
]);
