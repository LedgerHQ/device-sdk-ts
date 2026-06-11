import { bufferToHexaString } from "@ledgerhq/device-management-kit";

import {
  type Bs58Encoder,
  DefaultBs58Encoder,
} from "@internal/app-binder/services/bs58Encoder";

import * as K from "./kinds";
import {
  fail,
  MalformedDataError,
  TruncatedDataError,
  UnsupportedKindError,
} from "./TypePoolDecoderError";
import { type Entry, type LeafValue, type Ref } from "./types";

const textDecoder = new TextDecoder("utf-8");

function dataView(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Decodes scalar values (little-endian) from a Solana instruction-data buffer.
 * Injected into the decoder so the tree traversal stays decoder-agnostic and the
 * decoding can be swapped/tested in isolation.
 */
export interface DataReader {
  /**
   * Read an unsigned integer of `kind` at `offset`, returned as a `number`.
   * Supports the `SHORT_U16` varint (1–3 bytes) and the fixed unsigned/bool
   * kinds. Used for counts, flags and enum discriminators.
   */
  readUnsigned(
    data: Uint8Array,
    offset: number,
    kind: number,
  ): [value: number, nextOffset: number];

  /**
   * Read a primitive leaf of `kind` at `offset`. 64-/128-bit integers are
   * returned as `bigint`; smaller integers, floats and booleans as
   * `number`/`boolean`; `PUBKEY_32` as a base58 string.
   */
  readPrimitive(
    data: Uint8Array,
    offset: number,
    kind: number,
  ): [value: LeafValue, nextOffset: number];

  /** Decode raw bytes as UTF-8, or as hex when `encoding` is base16. */
  decodeString(raw: Uint8Array, encoding: number | undefined): string;
}

export class DefaultDataReader implements DataReader {
  constructor(private readonly bs58Encoder: Bs58Encoder = DefaultBs58Encoder) {}

  readUnsigned(
    data: Uint8Array,
    offset: number,
    kind: number,
  ): [number, number] {
    if (kind === K.KIND_SHORT_U16) {
      let value = 0;
      for (let i = 0; i < 3; i++) {
        if (offset >= data.length) {
          fail(new TruncatedDataError("truncated SHORT_U16"));
        }
        const byte = data[offset]!;
        offset += 1;
        value |= (byte & 0x7f) << (7 * i);
        if ((byte & 0x80) === 0) return [value >>> 0, offset];
      }
      // Continuation bit still set after 3 bytes: not a valid ShortU16.
      fail(new MalformedDataError("overlong SHORT_U16 varint"));
    }

    const size = K.PRIMITIVE_KIND_BYTE_SIZES.get(kind);
    if (size === undefined || !K.UNSIGNED_INT_KINDS.has(kind)) {
      fail(
        new UnsupportedKindError(
          `unsigned read not supported for kind 0x${kind
            .toString(16)
            .padStart(2, "0")}`,
        ),
      );
    }
    if (offset + size > data.length) {
      fail(
        new TruncatedDataError(
          `truncated unsigned read (kind=0x${kind.toString(16)})`,
        ),
      );
    }
    // Little-endian accumulation in bigint, then fail closed if the value is
    // not safely representable (these drive counts/flags/discriminators).
    let value = 0n;
    for (let i = size - 1; i >= 0; i--) {
      value = value * 256n + BigInt(data[offset + i]!);
    }
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      fail(
        new MalformedDataError(
          `unsigned value too large to represent (kind=0x${kind.toString(16)})`,
        ),
      );
    }
    return [Number(value), offset + size];
  }

  readPrimitive(
    data: Uint8Array,
    offset: number,
    kind: number,
  ): [LeafValue, number] {
    if (kind === K.KIND_SHORT_U16) {
      return this.readUnsigned(data, offset, kind);
    }

    if (kind === K.KIND_PUBKEY_32) {
      if (offset + 32 > data.length) {
        fail(new TruncatedDataError("truncated PUBKEY_32"));
      }
      return [
        this.bs58Encoder.encode(data.subarray(offset, offset + 32)),
        offset + 32,
      ];
    }

    const size = K.PRIMITIVE_KIND_BYTE_SIZES.get(kind);
    if (size === undefined) {
      fail(
        new UnsupportedKindError(
          `unknown primitive kind 0x${kind.toString(16).padStart(2, "0")}`,
        ),
      );
    }
    if (offset + size > data.length) {
      fail(
        new TruncatedDataError(
          `truncated primitive (kind=0x${kind.toString(16)})`,
        ),
      );
    }

    const view = dataView(data);
    const at = offset;
    const end = offset + size;

    switch (kind) {
      case K.KIND_F32:
        return [view.getFloat32(at, true), end];
      case K.KIND_F64:
        return [view.getFloat64(at, true), end];
      case K.KIND_BOOL_U8:
        return [data[at]! !== 0, end];
      case K.KIND_BOOL_U16:
        return [view.getUint16(at, true) !== 0, end];
      case K.KIND_BOOL_U32:
        return [view.getUint32(at, true) !== 0, end];
      case K.KIND_U8:
        return [data[at]!, end];
      case K.KIND_U16:
        return [view.getUint16(at, true), end];
      case K.KIND_U32:
        return [view.getUint32(at, true), end];
      case K.KIND_U64:
        return [view.getBigUint64(at, true), end];
      case K.KIND_I8:
        return [view.getInt8(at), end];
      case K.KIND_I16:
        return [view.getInt16(at, true), end];
      case K.KIND_I32:
        return [view.getInt32(at, true), end];
      case K.KIND_I64:
        return [view.getBigInt64(at, true), end];
      case K.KIND_U128:
      case K.KIND_I128: {
        let value = 0n;
        for (let i = size - 1; i >= 0; i--) {
          value = (value << 8n) | BigInt(data[at + i]!);
        }
        if (kind === K.KIND_I128 && value & (1n << 127n)) {
          value -= 1n << 128n;
        }
        return [value, end];
      }
      default:
        fail(
          new UnsupportedKindError(
            `unknown primitive kind 0x${kind.toString(16).padStart(2, "0")}`,
          ),
        );
    }
  }

  decodeString(raw: Uint8Array, encoding: number | undefined): string {
    if (encoding === K.ENCODING_BASE16) {
      return bufferToHexaString(raw, false);
    }
    return textDecoder.decode(raw);
  }
}

/**
 * Fixed serialized size of `entry`, or `undefined` if variable. Used by the
 * decoder's `OPTION_FIXED` handler, which advances by `size(inner)` even when
 * the flag is zero. A free function (not part of {@link DataReader}) because it
 * only inspects the descriptor, never the instruction-data buffer.
 */
export function fixedSizeOf(
  entry: Entry,
  resolver: (ref: Ref) => Entry,
): number | undefined {
  const kind = entry.kind;
  if (K.PRIMITIVE_KIND_BYTE_SIZES.has(kind)) {
    return K.PRIMITIVE_KIND_BYTE_SIZES.get(kind);
  }
  if (kind === K.KIND_BYTES_FIXED || kind === K.KIND_STRING_FIXED) {
    return entry.fixedSize;
  }
  if (kind === K.KIND_STRUCT || kind === K.KIND_TUPLE) {
    let total = 0;
    for (const ref of entry.refs) {
      const fieldSize = fixedSizeOf(resolver(ref), resolver);
      if (fieldSize === undefined) return undefined;
      total += fieldSize;
    }
    return total;
  }
  if (kind === K.KIND_ARRAY_FIXED) {
    const itemSize = fixedSizeOf(resolver(entry.refs[0]!), resolver);
    if (itemSize === undefined) return undefined;
    return (entry.fixedSize ?? 0) * itemSize;
  }
  if (kind === K.KIND_OPTION_FIXED) {
    const flagSize =
      K.PRIMITIVE_KIND_BYTE_SIZES.get(entry.flagKind ?? K.KIND_U8) ?? 1;
    const innerSize = fixedSizeOf(resolver(entry.refs[0]!), resolver);
    if (innerSize === undefined) return undefined;
    return flagSize + innerSize;
  }
  if (kind === K.KIND_OPTION_ZEROABLE) {
    return fixedSizeOf(resolver(entry.refs[0]!), resolver);
  }
  if (kind === K.KIND_HIDDEN_PREFIX || kind === K.KIND_HIDDEN_SUFFIX) {
    const skipSize = fixedSizeOf(resolver(entry.refs[0]!), resolver);
    const innerSize = fixedSizeOf(resolver(entry.refs[1]!), resolver);
    if (skipSize === undefined || innerSize === undefined) return undefined;
    return skipSize + innerSize;
  }
  return undefined;
}
