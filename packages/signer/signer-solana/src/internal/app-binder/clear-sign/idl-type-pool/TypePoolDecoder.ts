import { type Either, Left, Right } from "purify-ts";

import { packPath, PathPackError, type PathStep } from "./argumentPaths";
import { type DataReader, DefaultDataReader, fixedSizeOf } from "./dataReaders";
import * as K from "./kinds";
import { parsePool } from "./parsePool";
import {
  DecodeBudgetExceededError,
  fail,
  MAX_DECODE_DEPTH,
  MAX_DECODE_NODE_VISITS,
  NoProgressError,
  PoolIndexOutOfRangeError,
  TruncatedDataError,
  type TypePoolDecoderError,
  TypePoolDecoderThrow,
  UnsupportedKindError,
} from "./TypePoolDecoderError";
import {
  type DecodeResult,
  type Entry,
  type Leaf,
  type LeafValue,
  type Ref,
  type SelectedEnumVariant,
  type VariantCache,
  variantCacheKey,
} from "./types";

/** Decodes one entry, given its already-resolved {@link Entry} and path so far. */
type KindHandler = (entry: Entry, pathSteps: readonly PathStep[]) => void;

class TypePoolDecoder {
  private cursor = 0;
  private depth = 0;
  private nodeVisits = 0;
  private readonly leaves: Leaf[] = [];
  private readonly selectedEnumVariants: SelectedEnumVariant[] = [];

  /** Kind byte → per-kind decode handler. Built once per decode. */
  private readonly handlers: ReadonlyMap<number, KindHandler>;

  constructor(
    private readonly pool: Entry[],
    private readonly enumCache: VariantCache,
    private readonly data: Uint8Array,
    private readonly dataReader: DataReader = new DefaultDataReader(),
  ) {
    this.handlers = this.buildHandlers();
  }

  decode(rootIndex: number): DecodeResult {
    this.decodeEntry(this.resolve(rootIndex), []);
    return {
      leaves: this.leaves,
      selectedEnumVariants: this.selectedEnumVariants,
      cursorEnd: this.cursor,
    };
  }

  private resolve(ref: Ref): Entry {
    if (typeof ref !== "number") return ref;
    if (ref < 0 || ref >= this.pool.length) {
      fail(new PoolIndexOutOfRangeError(ref, this.pool.length));
    }
    return this.pool[ref]!;
  }

  private emit(pathSteps: readonly PathStep[], value: LeafValue): void {
    let packed: Uint8Array;
    try {
      packed = packPath(pathSteps);
    } catch (error) {
      if (error instanceof PathPackError) return; // unaddressable leaf — skip
      throw error;
    }
    this.leaves.push({ path: packed, value });
  }

  /** Resolve `ref` and decode it with one extra path step appended. */
  private descend(
    ref: Ref,
    pathSteps: readonly PathStep[],
    parentKind: number,
    stepValue: number,
    discKind?: number,
  ): void {
    this.decodeEntry(this.resolve(ref), [
      ...pathSteps,
      [parentKind, stepValue, discKind],
    ]);
  }

  private decodeEntry(entry: Entry, pathSteps: readonly PathStep[]): void {
    this.nodeVisits += 1;
    if (this.nodeVisits > MAX_DECODE_NODE_VISITS) {
      fail(
        new DecodeBudgetExceededError(
          `exceeded ${MAX_DECODE_NODE_VISITS} node visits`,
        ),
      );
    }
    this.depth += 1;
    if (this.depth > MAX_DECODE_DEPTH) {
      fail(
        new DecodeBudgetExceededError(
          `exceeded max nesting depth ${MAX_DECODE_DEPTH} (recursive type pool?)`,
        ),
      );
    }
    try {
      const handler = this.handlers.get(entry.kind);
      if (handler === undefined) {
        fail(
          new UnsupportedKindError(
            `decoder: unhandled kind 0x${entry.kind
              .toString(16)
              .padStart(2, "0")}`,
          ),
        );
      }
      handler(entry, pathSteps);
    } finally {
      this.depth -= 1;
    }
  }

  // ---- per-kind handlers ------------------------------------------------

  private readonly decodePrimitiveLeaf: KindHandler = (entry, steps) => {
    const [value, next] = this.dataReader.readPrimitive(
      this.data,
      this.cursor,
      entry.kind,
    );
    this.cursor = next;
    this.emit(steps, value);
  };

  private readonly decodeBytesFixed: KindHandler = (entry, steps) => {
    const size = entry.fixedSize ?? 0;
    if (this.cursor + size > this.data.length) {
      fail(new TruncatedDataError("truncated BYTES_FIXED leaf"));
    }
    const raw = this.data.subarray(this.cursor, this.cursor + size);
    this.cursor += size;
    // BYTES_FIXED is rendered as a hex string.
    this.emit(steps, this.dataReader.decodeString(raw, K.ENCODING_BASE16));
  };

  private readonly decodeStringFixed: KindHandler = (entry, steps) => {
    const size = entry.fixedSize ?? 0;
    if (this.cursor + size > this.data.length) {
      fail(new TruncatedDataError("truncated STRING_FIXED leaf"));
    }
    const raw = this.data.subarray(this.cursor, this.cursor + size);
    this.cursor += size;
    this.emit(steps, this.dataReader.decodeString(raw, entry.encoding));
  };

  private readonly decodeStringPrefixed: KindHandler = (entry, steps) => {
    const [length, afterLen] = this.dataReader.readUnsigned(
      this.data,
      this.cursor,
      entry.lenKind ?? K.KIND_U8,
    );
    this.cursor = afterLen;
    if (this.cursor + length > this.data.length) {
      fail(new TruncatedDataError("truncated STRING_PREFIXED leaf"));
    }
    const raw = this.data.subarray(this.cursor, this.cursor + length);
    this.cursor += length;
    this.emit(steps, this.dataReader.decodeString(raw, entry.encoding));
  };

  private readonly decodeBytesRemainder: KindHandler = (_entry, steps) => {
    const raw = this.data.subarray(this.cursor);
    this.cursor = this.data.length;
    this.emit(steps, raw);
  };

  private readonly decodeAggregate: KindHandler = (entry, steps) => {
    entry.refs.forEach((ref, subIdx) =>
      this.descend(ref, steps, entry.kind, subIdx),
    );
  };

  private readonly decodeArrayFixed: KindHandler = (entry, steps) => {
    const item = this.resolve(entry.refs[0]!);
    const count = entry.fixedSize ?? 0;
    for (let i = 0; i < count; i++) {
      this.decodeEntry(item, [...steps, [entry.kind, i, undefined]]);
    }
  };

  private readonly decodeArrayPrefixed: KindHandler = (entry, steps) => {
    const [length, afterLen] = this.dataReader.readUnsigned(
      this.data,
      this.cursor,
      entry.lenKind ?? K.KIND_U32,
    );
    this.cursor = afterLen;
    const item = this.resolve(entry.refs[0]!);
    for (let i = 0; i < length; i++) {
      this.decodeEntry(item, [...steps, [entry.kind, i, undefined]]);
    }
  };

  private readonly decodeArrayRemainder: KindHandler = (entry, steps) => {
    const item = this.resolve(entry.refs[0]!);
    let i = 0;
    while (this.cursor < this.data.length) {
      const start = this.cursor;
      this.decodeEntry(item, [...steps, [entry.kind, i, undefined]]);
      if (this.cursor <= start) {
        fail(new NoProgressError("ARRAY_REMAINDER item consumed no bytes"));
      }
      i += 1;
    }
  };

  private readonly decodeOptionDynamic: KindHandler = (entry, steps) => {
    const [flag, afterFlag] = this.dataReader.readUnsigned(
      this.data,
      this.cursor,
      entry.flagKind ?? K.KIND_U8,
    );
    this.cursor = afterFlag;
    if (flag !== 0) {
      this.descend(entry.refs[0]!, steps, entry.kind, 0);
    }
  };

  private readonly decodeOptionFixed: KindHandler = (entry, steps) => {
    const [flag, afterFlag] = this.dataReader.readUnsigned(
      this.data,
      this.cursor,
      entry.flagKind ?? K.KIND_U8,
    );
    this.cursor = afterFlag;
    const inner = this.resolve(entry.refs[0]!);
    if (flag !== 0) {
      this.decodeEntry(inner, [...steps, [entry.kind, 0, undefined]]);
      return;
    }
    const innerSize = fixedSizeOf(inner, (ref) => this.resolve(ref));
    if (innerSize === undefined) {
      fail(
        new UnsupportedKindError(
          "OPTION_FIXED with variable-size inner is not supported",
        ),
      );
    }
    if (this.cursor + innerSize > this.data.length) {
      fail(new TruncatedDataError("truncated OPTION_FIXED skip"));
    }
    this.cursor += innerSize;
  };

  private readonly decodeOptionZeroable: KindHandler = (entry, steps) => {
    const sentinel = entry.sentinel ?? new Uint8Array(0);
    const slice = this.data.subarray(
      this.cursor,
      this.cursor + sentinel.length,
    );
    if (
      slice.length === sentinel.length &&
      sentinel.every((byte, index) => byte === slice[index])
    ) {
      this.cursor += sentinel.length;
      return;
    }
    this.descend(entry.refs[0]!, steps, entry.kind, 0);
  };

  private readonly decodeOptionRemainder: KindHandler = (entry, steps) => {
    if (this.cursor < this.data.length) {
      this.descend(entry.refs[0]!, steps, entry.kind, 0);
    }
  };

  private readonly decodeEnum: KindHandler = (entry, steps) => {
    const [variantIndex, afterDiscriminator] = this.dataReader.readUnsigned(
      this.data,
      this.cursor,
      entry.discKind ?? K.KIND_U8,
    );
    this.cursor = afterDiscriminator;
    const enumId = entry.enumId ?? "";
    this.selectedEnumVariants.push({ enumId, variantIndex });
    const cached = this.enumCache.get(variantCacheKey(enumId, variantIndex));
    if (cached === undefined) {
      // No variant info: emit the raw discriminator and stop descending (the
      // cursor-end check then surfaces the under-consumption).
      this.emit(steps, variantIndex);
      return;
    }
    this.emit(steps, cached.variantName);
    const childSteps: PathStep[] = [
      ...steps,
      [entry.kind, variantIndex, entry.discKind],
    ];
    if (cached.kind === K.VARIANT_PAYLOAD_EMPTY) {
      return;
    }
    if (cached.kind === K.VARIANT_PAYLOAD_INLINE) {
      this.decodeEntry(cached.payload, childSteps);
      return;
    }
    // RAW_SIZE
    if (this.cursor + cached.size > this.data.length) {
      fail(new TruncatedDataError("truncated RAW_SIZE variant payload"));
    }
    this.cursor += cached.size;
  };

  private readonly decodeHiddenPrefix: KindHandler = (entry, steps) => {
    this.descend(entry.refs[0]!, steps, entry.kind, 1);
    this.descend(entry.refs[1]!, steps, entry.kind, 0);
  };

  private readonly decodeHiddenSuffix: KindHandler = (entry, steps) => {
    this.descend(entry.refs[1]!, steps, entry.kind, 0);
    this.descend(entry.refs[0]!, steps, entry.kind, 1);
  };

  private buildHandlers(): ReadonlyMap<number, KindHandler> {
    const handlers = new Map<number, KindHandler>();
    for (const kind of K.PRIMITIVE_KINDS) {
      handlers.set(kind, this.decodePrimitiveLeaf);
    }
    handlers.set(K.KIND_BYTES_FIXED, this.decodeBytesFixed);
    handlers.set(K.KIND_STRING_FIXED, this.decodeStringFixed);
    handlers.set(K.KIND_STRING_PREFIXED, this.decodeStringPrefixed);
    handlers.set(K.KIND_BYTES_REMAINDER, this.decodeBytesRemainder);
    handlers.set(K.KIND_STRUCT, this.decodeAggregate);
    handlers.set(K.KIND_TUPLE, this.decodeAggregate);
    handlers.set(K.KIND_ARRAY_FIXED, this.decodeArrayFixed);
    handlers.set(K.KIND_ARRAY_PREFIXED, this.decodeArrayPrefixed);
    handlers.set(K.KIND_ARRAY_REMAINDER, this.decodeArrayRemainder);
    handlers.set(K.KIND_OPTION_DYNAMIC, this.decodeOptionDynamic);
    handlers.set(K.KIND_OPTION_FIXED, this.decodeOptionFixed);
    handlers.set(K.KIND_OPTION_ZEROABLE, this.decodeOptionZeroable);
    handlers.set(K.KIND_OPTION_REMAINDER, this.decodeOptionRemainder);
    handlers.set(K.KIND_ENUM, this.decodeEnum);
    handlers.set(K.KIND_HIDDEN_PREFIX, this.decodeHiddenPrefix);
    handlers.set(K.KIND_HIDDEN_SUFFIX, this.decodeHiddenSuffix);
    return handlers;
  }
}

function runDecode(
  build: () => TypePoolDecoder,
  rootIndex: number,
): Either<TypePoolDecoderError, DecodeResult> {
  try {
    return Right(build().decode(rootIndex));
  } catch (error) {
    if (error instanceof TypePoolDecoderThrow) {
      return Left(error.error);
    }
    return Left(
      new UnsupportedKindError(
        `internal decoder error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    );
  }
}

/**
 * Decode `data` under `pool[rootIndex]`, returning the emitted leaves, the
 * selected enum variants, and the final cursor position. Pure and
 * deterministic; scalar decoding is delegated to `dataReader`. Malformed input
 * surfaces as a typed {@link TypePoolDecoderError} `Left` — never throws.
 */
export function decode(
  pool: Entry[],
  rootIndex: number,
  enumCache: VariantCache,
  data: Uint8Array,
  dataReader: DataReader = new DefaultDataReader(),
): Either<TypePoolDecoderError, DecodeResult> {
  return runDecode(
    () => new TypePoolDecoder(pool, enumCache, data, dataReader),
    rootIndex,
  );
}

/**
 * Convenience wrapper over {@link decode} that accepts the raw `IDL_TYPE_POOL`
 * TLV value (`u8 count || entries…`) and parses it before decoding. Parse
 * failures surface as the same typed {@link TypePoolDecoderError} `Left`.
 */
export function decodePoolBytes(
  typePool: Uint8Array,
  rootType: number,
  enumCache: VariantCache,
  data: Uint8Array,
  dataReader: DataReader = new DefaultDataReader(),
): Either<TypePoolDecoderError, DecodeResult> {
  return runDecode(
    () => new TypePoolDecoder(parsePool(typePool), enumCache, data, dataReader),
    rootType,
  );
}
