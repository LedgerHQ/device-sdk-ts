import * as K from "./kinds";
import {
  fail,
  TrailingBytesError,
  TruncatedDataError,
  UnknownKindError,
} from "./TypePoolDecoderError";
import { type Entry, type Ref } from "./types";

const textDecoder = new TextDecoder("utf-8");

/**
 * Cursor over a descriptor buffer with bounds-checked, self-advancing reads.
 * Every read fails closed with a typed {@link TruncatedDataError}.
 */
class ByteReader {
  constructor(
    private readonly buffer: Uint8Array,
    private offset = 0,
  ) {}

  private ensureAvailable(byteCount: number, context: string): void {
    if (this.offset + byteCount > this.buffer.length) {
      fail(new TruncatedDataError(context));
    }
  }

  u8(context: string): number {
    this.ensureAvailable(1, context);
    return this.buffer[this.offset++]!;
  }

  u16be(context: string): number {
    this.ensureAvailable(2, context);
    const value =
      (this.buffer[this.offset]! << 8) | this.buffer[this.offset + 1]!;
    this.offset += 2;
    return value;
  }

  take(byteCount: number, context: string): Uint8Array {
    this.ensureAvailable(byteCount, context);
    const slice = this.buffer.slice(this.offset, this.offset + byteCount);
    this.offset += byteCount;
    return slice;
  }

  get done(): boolean {
    return this.offset >= this.buffer.length;
  }

  get remaining(): number {
    return this.buffer.length - this.offset;
  }
}

/** Reads the fields (everything past the kind byte) of one entry of a kind. */
type EntryFieldsReader = (
  reader: ByteReader,
  readRef: () => Ref,
) => Omit<Entry, "kind">;

/**
 * Per-kind field readers, keyed by kind byte. `readRef` yields a pool index in
 * pool mode and a recursively-parsed nested {@link Entry} in inline mode — the
 * only difference between the two parse modes, so one table serves both.
 */
const FIELD_READERS: ReadonlyMap<number, EntryFieldsReader> = (() => {
  const readers = new Map<number, EntryFieldsReader>();
  const leaf: EntryFieldsReader = () => ({ refs: [] });

  // Scalar leaves carry no inline args.
  for (const kind of K.PRIMITIVE_KINDS) readers.set(kind, leaf);
  readers.set(K.KIND_BYTES_REMAINDER, leaf);

  readers.set(K.KIND_BYTES_FIXED, (reader) => ({
    refs: [],
    fixedSize: reader.u16be("truncated BYTES_FIXED size"),
  }));

  readers.set(K.KIND_STRING_FIXED, (reader) => {
    const fixedSize = reader.u16be("truncated STRING_FIXED size");
    const encoding = reader.u8("truncated STRING_FIXED encoding");
    return { refs: [], fixedSize, encoding };
  });

  readers.set(K.KIND_STRING_PREFIXED, (reader) => {
    const lenKind = reader.u8("truncated STRING_PREFIXED len_kind");
    const encoding = reader.u8("truncated STRING_PREFIXED encoding");
    return { refs: [], lenKind, encoding };
  });

  const aggregate: EntryFieldsReader = (reader, readRef) => {
    const fieldCount = reader.u8("truncated STRUCT/TUPLE count");
    const refs: Ref[] = [];
    for (let i = 0; i < fieldCount; i++) refs.push(readRef());
    return { refs };
  };
  readers.set(K.KIND_STRUCT, aggregate);
  readers.set(K.KIND_TUPLE, aggregate);

  const option: EntryFieldsReader = (reader, readRef) => {
    const flagKind = reader.u8("truncated OPTION_* flag_kind");
    return { flagKind, refs: [readRef()] };
  };
  readers.set(K.KIND_OPTION_DYNAMIC, option);
  readers.set(K.KIND_OPTION_FIXED, option);

  readers.set(K.KIND_OPTION_ZEROABLE, (reader, readRef) => {
    const inner = readRef();
    const sentinelLen = reader.u8("truncated OPTION_ZEROABLE sentinel_len");
    const sentinel = reader.take(
      sentinelLen,
      "truncated OPTION_ZEROABLE sentinel",
    );
    return { refs: [inner], sentinel };
  });

  readers.set(K.KIND_ARRAY_FIXED, (reader, readRef) => {
    const fixedSize = reader.u16be("truncated ARRAY_FIXED count");
    return { fixedSize, refs: [readRef()] };
  });

  readers.set(K.KIND_ARRAY_PREFIXED, (reader, readRef) => {
    const lenKind = reader.u8("truncated ARRAY_PREFIXED len_kind");
    return { lenKind, refs: [readRef()] };
  });

  const remainder: EntryFieldsReader = (_reader, readRef) => ({
    refs: [readRef()],
  });
  readers.set(K.KIND_ARRAY_REMAINDER, remainder);
  readers.set(K.KIND_OPTION_REMAINDER, remainder);

  readers.set(K.KIND_ENUM, (reader) => {
    const discKind = reader.u8("truncated ENUM disc_kind");
    const totalVariants = reader.u16be("truncated ENUM total_variants");
    const idLength = reader.u8("truncated ENUM enum_id_len");
    const enumId = textDecoder.decode(
      reader.take(idLength, "truncated ENUM enum_id"),
    );
    return { refs: [], discKind, totalVariants, enumId };
  });

  const hidden: EntryFieldsReader = (_reader, readRef) => {
    const skip = readRef();
    const inner = readRef();
    return { refs: [skip, inner] };
  };
  readers.set(K.KIND_HIDDEN_PREFIX, hidden);
  readers.set(K.KIND_HIDDEN_SUFFIX, hidden);

  return readers;
})();

/**
 * Parse a kind byte + its inline arguments from `reader`. When `inline` is
 * true, every `*_ref` slot is a recursively-parsed descriptor (used inside
 * `ENUM_VARIANT` payloads); otherwise refs are `u8` pool indices.
 */
function parseEntry(reader: ByteReader, inline: boolean): Entry {
  const kind = reader.u8("truncated entry header");
  const readFields = FIELD_READERS.get(kind);
  if (readFields === undefined) {
    fail(new UnknownKindError(kind));
  }
  const readRef = (): Ref =>
    inline ? parseEntry(reader, true) : reader.u8("truncated ref");
  return { kind, ...readFields(reader, readRef) };
}

/**
 * Parse the `IDL_TYPE_POOL` TLV value into a list of {@link Entry}.
 *
 * The TLV value is `u8 count || entry_0 || ... || entry_{count-1}`.
 *
 * @throws never — wrap with the public `decode` entry points which return
 * `Either`. Internally throws {@link TypePoolDecoderThrow}; do not call directly across
 * a module boundary.
 */
export function parsePool(buffer: Uint8Array): Entry[] {
  if (buffer.length === 0) {
    fail(new TruncatedDataError("empty pool buffer"));
  }
  const reader = new ByteReader(buffer);
  const entryCount = reader.u8("truncated pool count");
  const entries: Entry[] = [];
  for (let i = 0; i < entryCount; i++) {
    entries.push(parseEntry(reader, false));
  }
  if (!reader.done) {
    fail(new TrailingBytesError(reader.remaining, "pool"));
  }
  return entries;
}

/** Parse a self-contained inline variant-payload descriptor. */
export function parseInlinePayload(buffer: Uint8Array): Entry {
  const reader = new ByteReader(buffer);
  const entry = parseEntry(reader, true);
  if (!reader.done) {
    fail(new TrailingBytesError(reader.remaining, "inline payload"));
  }
  return entry;
}
