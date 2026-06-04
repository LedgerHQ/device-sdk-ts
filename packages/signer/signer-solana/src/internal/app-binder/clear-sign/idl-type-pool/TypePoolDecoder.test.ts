import {
  arrayPrefixed,
  arrayRemainder,
  bytes,
  bytesRemainder,
  concat,
  enumEntry,
  optionDynamic,
  optionFixed,
  optionZeroable,
  pool,
  pubkey,
  stringPrefixed,
  struct,
  tuple,
  u8,
  u16,
  u16le,
  u32,
  u32le,
  u64,
  u64le,
} from "./__tests__/fixtures/builders";
import {
  JUPITER_DATA,
  JUPITER_IN_AMOUNT,
  JUPITER_PLATFORM_FEE_BPS,
  JUPITER_POOL,
  JUPITER_QUOTED_OUT_AMOUNT,
  JUPITER_ROOT,
  JUPITER_SLIPPAGE_BPS,
  JUPITER_SWAP_VARIANT_INDEX,
} from "./__tests__/fixtures/jupiterRoute";
import { packPath } from "./argumentPaths";
import { type DataReader, DefaultDataReader } from "./dataReaders";
import * as K from "./kinds";
import { parseInlinePayload, parsePool } from "./parsePool";
import { decode } from "./TypePoolDecoder";
import {
  DecodeBudgetExceededError,
  NoProgressError,
  PoolIndexOutOfRangeError,
  TruncatedDataError,
  UnsupportedKindError,
} from "./TypePoolDecoderError";
import {
  type CachedVariant,
  type LeafValue,
  type VariantCache,
  variantCacheKey,
} from "./types";

const EMPTY_CACHE: VariantCache = new Map();

function makeCache(
  entries: [enumId: string, index: number, variant: CachedVariant][],
): VariantCache {
  return new Map(entries.map(([id, idx, v]) => [variantCacheKey(id, idx), v]));
}

/** Decode a raw pool value and unwrap the Right (fails the test on Left). */
function decodeOrThrow(
  poolBytes: Uint8Array,
  root: number,
  data: Uint8Array,
  cache = EMPTY_CACHE,
) {
  const result = decode(parsePool(poolBytes), root, cache, data);
  return result.unsafeCoerce();
}

describe("TypePoolDecoder", () => {
  describe("primitive reads", () => {
    it("reads each integer width little-endian, 64/128-bit as bigint", () => {
      const p = pool([struct([1, 2, 3, 4]), u8(), u16(), u32(), u64()]);
      const data = concat(
        bytes(0xff),
        u16le(0x1234),
        u32le(0xdeadbeef),
        u64le(50_000_000_000n),
      );
      const { leaves, cursorEnd } = decodeOrThrow(p, 0, data);
      expect(leaves.map((l) => l.value)).toEqual([
        0xff,
        0x1234,
        0xdeadbeef,
        50_000_000_000n,
      ]);
      expect(cursorEnd).toBe(data.length);
    });

    it("sign-extends signed integers", () => {
      const p = pool([struct([1]), bytes(K.KIND_I8)]);
      const { leaves } = decodeOrThrow(p, 0, bytes(0xff));
      expect(leaves[0]!.value).toBe(-1);
    });

    it("decodes a PUBKEY_32 leaf as base58", () => {
      const raw = new Uint8Array(32).fill(0); // all-zero pubkey
      const p = pool([struct([1]), pubkey()]);
      const { leaves } = decodeOrThrow(p, 0, raw);
      expect(leaves[0]!.value).toBe("11111111111111111111111111111111");
    });

    it("reads a BOOL_U8 as a boolean", () => {
      const p = pool([struct([1]), bytes(K.KIND_BOOL_U8)]);
      expect(decodeOrThrow(p, 0, bytes(7)).leaves[0]!.value).toBe(true);
      expect(decodeOrThrow(p, 0, bytes(0)).leaves[0]!.value).toBe(false);
    });

    it("reads a SHORT_U16 varint (1-3 bytes)", () => {
      const p = pool([struct([1]), bytes(K.KIND_SHORT_U16)]);
      // 300 = 0xAC 0x02 in ShortU16.
      const { leaves, cursorEnd } = decodeOrThrow(p, 0, bytes(0xac, 0x02));
      expect(leaves[0]!.value).toBe(300);
      expect(cursorEnd).toBe(2);
    });
  });

  describe("aggregates", () => {
    it("decodes a fixed array, emitting one leaf per element with array-index paths", () => {
      const p = pool([
        struct([1]),
        bytes(K.KIND_ARRAY_FIXED, 0x00, 0x03, 2),
        u8(),
      ]);
      const { leaves } = decodeOrThrow(p, 0, bytes(10, 20, 30));
      expect(leaves.map((l) => l.value)).toEqual([10, 20, 30]);
      // path = [STRUCT field 0][ARRAY_FIXED index i] → step_count 2, struct(u8)=0, idx(u16be)
      expect(Array.from(leaves[0]!.path)).toEqual([2, 0, 0x00, 0x00]);
      expect(Array.from(leaves[2]!.path)).toEqual([2, 0, 0x00, 0x02]);
    });

    it("reads a length-prefixed array", () => {
      const p = pool([struct([1]), arrayPrefixed(K.KIND_U32, 2), u8()]);
      const { leaves } = decodeOrThrow(p, 0, concat(u32le(2), bytes(7, 8)));
      expect(leaves.map((l) => l.value)).toEqual([7, 8]);
    });

    it("reads a remainder array until end of buffer", () => {
      const p = pool([struct([1]), arrayRemainder(2), u8()]);
      const { leaves, cursorEnd } = decodeOrThrow(p, 0, bytes(1, 2, 3, 4));
      expect(leaves.map((l) => l.value)).toEqual([1, 2, 3, 4]);
      expect(cursorEnd).toBe(4);
    });

    it("emits BYTES_REMAINDER as raw bytes", () => {
      const p = pool([struct([1]), bytesRemainder()]);
      const { leaves } = decodeOrThrow(p, 0, bytes(0xaa, 0xbb));
      expect(leaves[0]!.value).toEqual(bytes(0xaa, 0xbb));
    });

    it("decodes a tuple", () => {
      const p = pool([tuple([1, 2]), u8(), u16()]);
      const { leaves } = decodeOrThrow(p, 0, concat(bytes(9), u16le(0x0102)));
      expect(leaves.map((l) => l.value)).toEqual([9, 0x0102]);
    });

    it("decodes a STRING_PREFIXED leaf", () => {
      const p = pool([struct([1]), stringPrefixed(K.KIND_U8)]);
      const data = concat(bytes(2), bytes(0x68, 0x69)); // len 2, "hi"
      expect(decodeOrThrow(p, 0, data).leaves[0]!.value).toBe("hi");
    });
  });

  describe("options", () => {
    it("OPTION_DYNAMIC decodes the inner only when the flag is set", () => {
      const p = pool([struct([1]), optionDynamic(K.KIND_U8, 2), u32()]);
      expect(decodeOrThrow(p, 0, bytes(0)).leaves).toHaveLength(0);
      const some = decodeOrThrow(p, 0, concat(bytes(1), u32le(42)));
      expect(some.leaves[0]!.value).toBe(42);
    });

    it("OPTION_FIXED always advances by size(inner) even when absent", () => {
      const p = pool([struct([1, 2]), optionFixed(K.KIND_U8, 3), u8(), u32()]);
      // flag=0 → skip 4 inner bytes without emitting; then trailing u8.
      const data = concat(bytes(0), u32le(0xdeadbeef), bytes(0x77));
      const { leaves, cursorEnd } = decodeOrThrow(p, 0, data);
      expect(leaves.map((l) => l.value)).toEqual([0x77]);
      expect(cursorEnd).toBe(data.length);
    });

    it("OPTION_ZEROABLE skips the sentinel, else decodes inner", () => {
      const sentinel = bytes(0, 0, 0, 0);
      const p = pool([struct([1]), optionZeroable(2, sentinel), u32()]);
      expect(decodeOrThrow(p, 0, bytes(0, 0, 0, 0)).leaves).toHaveLength(0);
      expect(decodeOrThrow(p, 0, u32le(5)).leaves[0]!.value).toBe(5);
    });
  });

  describe("enums", () => {
    const enumPool = pool([struct([1]), enumEntry(K.KIND_U8, 4, "action")]);

    it("on a cache miss, emits the integer discriminator and stops", () => {
      const { leaves, cursorEnd, selectedEnumVariants } = decodeOrThrow(
        enumPool,
        0,
        bytes(2),
      );
      expect(leaves[0]!.value).toBe(2);
      expect(cursorEnd).toBe(1);
      expect(selectedEnumVariants).toEqual([
        { enumId: "action", variantIndex: 2 },
      ]);
    });

    it("on an EMPTY variant, emits the variant name and advances only the disc", () => {
      const cache = makeCache([
        ["action", 2, { variantName: "stake", kind: K.VARIANT_PAYLOAD_EMPTY }],
      ]);
      const { leaves, cursorEnd } = decode(
        parsePool(enumPool),
        0,
        cache,
        bytes(2),
      ).unsafeCoerce();
      expect(leaves[0]!.value).toBe("stake");
      expect(cursorEnd).toBe(1);
    });

    it("decodes an INLINE struct payload", () => {
      // inline payload = STRUCT { u8, u32 }
      const inline = bytes(K.KIND_STRUCT, 2, K.KIND_U8, K.KIND_U32);
      const cache = makeCache([
        [
          "action",
          1,
          {
            variantName: "deposit",
            kind: K.VARIANT_PAYLOAD_INLINE,
            payload: parseInlinePayload(inline),
          },
        ],
      ]);
      const data = concat(bytes(1), bytes(9), u32le(1000));
      const { leaves, cursorEnd } = decode(
        parsePool(enumPool),
        0,
        cache,
        data,
      ).unsafeCoerce();
      expect(leaves.map((l) => l.value)).toEqual(["deposit", 9, 1000]);
      expect(cursorEnd).toBe(data.length);
    });

    it("skips a RAW_SIZE variant payload by its byte count", () => {
      const cache = makeCache([
        [
          "action",
          3,
          { variantName: "raw", kind: K.VARIANT_PAYLOAD_RAW_SIZE, size: 4 },
        ],
      ]);
      const data = concat(bytes(3), bytes(1, 2, 3, 4));
      const { leaves, cursorEnd } = decode(
        parsePool(enumPool),
        0,
        cache,
        data,
      ).unsafeCoerce();
      expect(leaves.map((l) => l.value)).toEqual(["raw"]);
      expect(cursorEnd).toBe(data.length);
    });
  });

  describe("jupiter.route worked example", () => {
    it("extracts every displayed leaf at the documented paths", () => {
      const { leaves, cursorEnd, selectedEnumVariants } = decodeOrThrow(
        JUPITER_POOL,
        JUPITER_ROOT,
        JUPITER_DATA,
      );
      // Fully consumes the 35-byte argument data.
      expect(cursorEnd).toBe(JUPITER_DATA.length);

      const byPath = (steps: Parameters<typeof packPath>[0]) => {
        const target = packPath(steps);
        return leaves.find(
          (l) =>
            l.path.length === target.length &&
            l.path.every((b, i) => b === target[i]),
        )?.value;
      };

      expect(byPath([[K.KIND_STRUCT, 2, undefined]])).toBe(JUPITER_IN_AMOUNT);
      expect(byPath([[K.KIND_STRUCT, 3, undefined]])).toBe(
        JUPITER_QUOTED_OUT_AMOUNT,
      );
      expect(byPath([[K.KIND_STRUCT, 4, undefined]])).toBe(
        JUPITER_SLIPPAGE_BPS,
      );
      expect(byPath([[K.KIND_STRUCT, 5, undefined]])).toBe(
        JUPITER_PLATFORM_FEE_BPS,
      );
      expect(selectedEnumVariants).toEqual([
        { enumId: "swap", variantIndex: JUPITER_SWAP_VARIANT_INDEX },
      ]);
    });

    it("is deterministic across repeated decodes", () => {
      const a = decodeOrThrow(JUPITER_POOL, JUPITER_ROOT, JUPITER_DATA);
      const b = decodeOrThrow(JUPITER_POOL, JUPITER_ROOT, JUPITER_DATA);
      expect(a.leaves.map((l) => [Array.from(l.path), l.value])).toEqual(
        b.leaves.map((l) => [Array.from(l.path), l.value]),
      );
    });
  });

  describe("defensive: malformed input returns typed errors, never throws", () => {
    it("truncated instruction data → TruncatedDataError", () => {
      const p = pool([struct([1]), u32()]);
      const result = decode(parsePool(p), 0, EMPTY_CACHE, bytes(1, 2));
      expect(result.isLeft()).toBe(true);
      result.ifLeft((e) => expect(e).toBeInstanceOf(TruncatedDataError));
    });

    it("pool ref out of range → PoolIndexOutOfRangeError", () => {
      const p = pool([struct([9])]); // ref 9 does not exist
      const result = decode(parsePool(p), 0, EMPTY_CACHE, bytes(1));
      expect(result.isLeft()).toBe(true);
      result.ifLeft((e) => expect(e).toBeInstanceOf(PoolIndexOutOfRangeError));
    });

    it("empty pool with an out-of-range root → PoolIndexOutOfRangeError", () => {
      const result = decode([], 0, EMPTY_CACHE, bytes());
      expect(result.isLeft()).toBe(true);
      result.ifLeft((e) => expect(e).toBeInstanceOf(PoolIndexOutOfRangeError));
    });

    it("recursive type-pool cycle → DecodeBudgetExceededError", () => {
      // entry 0 is a struct that references itself.
      const cyclic = pool([struct([0])]);
      const result = decode(
        parsePool(cyclic),
        0,
        EMPTY_CACHE,
        bytes(1, 2, 3, 4),
      );
      expect(result.isLeft()).toBe(true);
      result.ifLeft((e) => expect(e).toBeInstanceOf(DecodeBudgetExceededError));
    });

    it("oversize ARRAY_PREFIXED length → TruncatedDataError", () => {
      const p = pool([struct([1]), arrayPrefixed(K.KIND_U32, 2), u8()]);
      // claims 1e9 elements but provides none.
      const result = decode(parsePool(p), 0, EMPTY_CACHE, u32le(1_000_000_000));
      expect(result.isLeft()).toBe(true);
      result.ifLeft((e) => expect(e).toBeInstanceOf(TruncatedDataError));
    });

    it("ARRAY_REMAINDER over a zero-width item → NoProgressError", () => {
      // item is an OPTION_FIXED(u8 flag, empty struct) → 1-byte flag still
      // advances; instead use a struct with no fields (zero width).
      const p = pool([struct([1]), arrayRemainder(2), struct([])]);
      const result = decode(parsePool(p), 0, EMPTY_CACHE, bytes(1, 2));
      expect(result.isLeft()).toBe(true);
      result.ifLeft((e) => expect(e).toBeInstanceOf(NoProgressError));
    });

    it("OPTION_FIXED with variable-size inner → UnsupportedKindError", () => {
      const p = pool([
        struct([1]),
        optionFixed(K.KIND_U8, 2),
        arrayRemainder(3),
        u8(),
      ]);
      const result = decode(parsePool(p), 0, EMPTY_CACHE, bytes(0));
      expect(result.isLeft()).toBe(true);
      result.ifLeft((e) => expect(e).toBeInstanceOf(UnsupportedKindError));
    });
  });

  describe("dependency injection", () => {
    it("delegates scalar decoding to the injected DataReader", () => {
      const calls: number[] = [];
      const spyReader: DataReader = {
        readUnsigned: (data, offset, kind) => {
          calls.push(kind);
          return new DefaultDataReader().readUnsigned(data, offset, kind);
        },
        readPrimitive: (data, offset, kind) => {
          calls.push(kind);
          return new DefaultDataReader().readPrimitive(data, offset, kind);
        },
        decodeString: (raw, encoding) =>
          new DefaultDataReader().decodeString(raw, encoding),
      };
      const p = pool([struct([1]), u32()]);
      const result = decode(parsePool(p), 0, EMPTY_CACHE, u32le(42), spyReader);
      expect(result.unsafeCoerce().leaves[0]!.value).toBe(42);
      expect(calls).toContain(K.KIND_U32); // the injected reader was used
    });

    it("can swap the leaf representation via a custom reader", () => {
      const base = new DefaultDataReader();
      const taggingReader: DataReader = {
        readUnsigned: (data, offset, kind) =>
          base.readUnsigned(data, offset, kind),
        readPrimitive: (): [LeafValue, number] => ["TAGGED", 4],
        decodeString: (raw, encoding) => base.decodeString(raw, encoding),
      };
      const p = pool([struct([1]), u32()]);
      const result = decode(
        parsePool(p),
        0,
        EMPTY_CACHE,
        u32le(42),
        taggingReader,
      );
      expect(result.unsafeCoerce().leaves[0]!.value).toBe("TAGGED");
    });
  });
});
