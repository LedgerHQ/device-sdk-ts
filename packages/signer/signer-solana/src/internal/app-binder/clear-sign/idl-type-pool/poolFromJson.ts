import { type SolanaCalTypePoolEntry } from "@ledgerhq/context-module";

import * as K from "./kinds";
import { fail, MalformedDataError } from "./TypePoolDecoderError";
import { type Entry } from "./types";

/**
 * One IDL type-pool entry as CAL serves it in `idl_descriptor.type_pool` (the
 * JSON mirror of the signed `IDL_TYPE_POOL` TLV) — the canonical shape
 * context-module surfaces. Field presence depends on `kind`, absent fields
 * default the same way the TLV parser would.
 */
export type CalTypePoolEntry = SolanaCalTypePoolEntry;

/** CAL `kind` string → on-wire kind byte (mirror of {@link K}). */
const KIND_BY_NAME: Readonly<Record<string, number>> = {
  U8: K.KIND_U8,
  U16: K.KIND_U16,
  U32: K.KIND_U32,
  U64: K.KIND_U64,
  U128: K.KIND_U128,
  I8: K.KIND_I8,
  I16: K.KIND_I16,
  I32: K.KIND_I32,
  I64: K.KIND_I64,
  I128: K.KIND_I128,
  F32: K.KIND_F32,
  F64: K.KIND_F64,
  SHORT_U16: K.KIND_SHORT_U16,
  BOOL_U8: K.KIND_BOOL_U8,
  BOOL_U16: K.KIND_BOOL_U16,
  BOOL_U32: K.KIND_BOOL_U32,
  PUBKEY_32: K.KIND_PUBKEY_32,
  BYTES_FIXED: K.KIND_BYTES_FIXED,
  STRING_FIXED: K.KIND_STRING_FIXED,
  STRING_PREFIXED: K.KIND_STRING_PREFIXED,
  BYTES_REMAINDER: K.KIND_BYTES_REMAINDER,
  STRUCT: K.KIND_STRUCT,
  TUPLE: K.KIND_TUPLE,
  OPTION_DYNAMIC: K.KIND_OPTION_DYNAMIC,
  OPTION_FIXED: K.KIND_OPTION_FIXED,
  OPTION_ZEROABLE: K.KIND_OPTION_ZEROABLE,
  ARRAY_FIXED: K.KIND_ARRAY_FIXED,
  ARRAY_PREFIXED: K.KIND_ARRAY_PREFIXED,
  ARRAY_REMAINDER: K.KIND_ARRAY_REMAINDER,
  ENUM: K.KIND_ENUM,
  HIDDEN_PREFIX: K.KIND_HIDDEN_PREFIX,
  HIDDEN_SUFFIX: K.KIND_HIDDEN_SUFFIX,
  OPTION_REMAINDER: K.KIND_OPTION_REMAINDER,
};

function kindByte(name: string): number {
  const byte = KIND_BY_NAME[name];
  if (byte === undefined)
    fail(new MalformedDataError(`unknown kind "${name}"`));
  return byte;
}

/** Map an inline `*_kind` marker string to its byte; defaults to `U8`. */
function markerByte(name: string | undefined): number {
  return name === undefined ? K.KIND_U8 : kindByte(name);
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) fail(new MalformedDataError("odd-length sentinel"));
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) fail(new MalformedDataError("non-hex sentinel"));
    out[i] = byte;
  }
  return out;
}

function entryFromJson(json: CalTypePoolEntry): Entry {
  const kind = kindByte(json.kind);
  const refs = json.refs ?? [];
  const entry: Entry = { kind, refs };
  if (json.size !== undefined) entry.fixedSize = json.size;
  if (json.encoding !== undefined) entry.encoding = json.encoding;
  if (json.len_kind !== undefined) entry.lenKind = markerByte(json.len_kind);
  if (json.flag_kind !== undefined) entry.flagKind = markerByte(json.flag_kind);
  if (json.sentinel !== undefined) entry.sentinel = hexToBytes(json.sentinel);
  if (kind === K.KIND_ENUM) {
    entry.discKind = markerByte(json.disc_kind);
    entry.totalVariants = json.total_variants ?? 0;
    entry.enumId = json.enum_id ?? "";
  }
  return entry;
}

/**
 * Build the decoder's `Entry[]` pool from CAL's decoded `type_pool` JSON.
 * Entries are ordered by their declared `index`.
 *
 * @throws never — call from inside the {@link decode} `runDecode` boundary, or
 * wrap with the public `Either` entry points; throws {@link TypePoolDecoderThrow}.
 */
export function poolFromJson(entries: CalTypePoolEntry[]): Entry[] {
  const pool = new Array<Entry>(entries.length);
  for (const json of entries) {
    if (json.index < 0 || json.index >= entries.length) {
      fail(
        new MalformedDataError(`type_pool index ${json.index} out of range`),
      );
    }
    pool[json.index] = entryFromJson(json);
  }
  for (let i = 0; i < pool.length; i++) {
    if (pool[i] === undefined) {
      fail(new MalformedDataError(`type_pool missing entry at index ${i}`));
    }
  }
  return pool;
}
