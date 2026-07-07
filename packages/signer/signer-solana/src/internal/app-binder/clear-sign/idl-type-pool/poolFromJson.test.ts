import {
  arrayPrefixed,
  bytesFixed,
  enumEntry,
  optionZeroable,
  pool,
  stringPrefixed,
  struct,
  u64,
} from "./__tests__/fixtures/builders";
import * as K from "./kinds";
import { parsePool } from "./parsePool";
import { type CalTypePoolEntry, poolFromJson } from "./poolFromJson";

describe("poolFromJson", () => {
  it("produces the same Entry[] as parsing the equivalent TLV (lossless)", () => {
    const sentinel = new Uint8Array(32);
    // TLV pool covering every field-bearing kind.
    const tlvPool = pool([
      bytesFixed(8), // 0
      enumEntry(K.KIND_U8, 142, "swap"), // 1
      struct([0, 1]), // 2
      arrayPrefixed(K.KIND_U32, 2), // 3
      optionZeroable(3, sentinel), // 4
      stringPrefixed(K.KIND_U64, K.ENCODING_UTF8), // 5
      u64(), // 6
    ]);

    const jsonPool: CalTypePoolEntry[] = [
      { index: 0, kind: "BYTES_FIXED", size: 8 },
      {
        index: 1,
        kind: "ENUM",
        disc_kind: "U8",
        total_variants: 142,
        enum_id: "swap",
      },
      { index: 2, kind: "STRUCT", refs: [0, 1] },
      { index: 3, kind: "ARRAY_PREFIXED", refs: [2], len_kind: "U32" },
      {
        index: 4,
        kind: "OPTION_ZEROABLE",
        refs: [3],
        sentinel: "00".repeat(32),
      },
      { index: 5, kind: "STRING_PREFIXED", encoding: 0, len_kind: "U64" },
      { index: 6, kind: "U64" },
    ];

    expect(poolFromJson(jsonPool)).toEqual(parsePool(tlvPool));
  });

  it("orders entries by their declared index", () => {
    const out = poolFromJson([
      { index: 1, kind: "U8" },
      { index: 0, kind: "U64" },
    ]);
    expect(out.map((e) => e.kind)).toEqual([K.KIND_U64, K.KIND_U8]);
  });

  it("rejects an unknown kind", () => {
    expect(() => poolFromJson([{ index: 0, kind: "NOPE" }])).toThrow(
      /unknown kind/,
    );
  });

  it("rejects a missing / out-of-range index", () => {
    expect(() => poolFromJson([{ index: 5, kind: "U8" }])).toThrow(
      /out of range/,
    );
  });
});
