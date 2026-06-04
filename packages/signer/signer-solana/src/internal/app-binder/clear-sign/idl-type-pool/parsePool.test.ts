import {
  bytes,
  enumEntry,
  pool,
  struct,
  u8,
} from "./__tests__/fixtures/builders";
import * as K from "./kinds";
import { parseInlinePayload, parsePool } from "./parsePool";
import {
  TrailingBytesError,
  TruncatedDataError,
  TypePoolDecoderThrow,
  UnknownKindError,
} from "./TypePoolDecoderError";

/** parsePool throws TypePoolDecoderThrow internally; capture the wrapped error. */
function expectParseError(buf: Uint8Array): TypePoolDecoderThrow {
  try {
    parsePool(buf);
  } catch (e) {
    if (e instanceof TypePoolDecoderThrow) return e;
    throw e;
  }
  throw new Error("expected parsePool to throw");
}

describe("parsePool", () => {
  it("parses a pool with refs and an ENUM entry", () => {
    const entries = parsePool(
      pool([struct([1, 2]), u8(), enumEntry(K.KIND_U8, 142, "swap")]),
    );
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ kind: K.KIND_STRUCT, refs: [1, 2] });
    expect(entries[2]).toMatchObject({
      kind: K.KIND_ENUM,
      discKind: K.KIND_U8,
      totalVariants: 142,
      enumId: "swap",
    });
  });

  it("rejects an empty buffer", () => {
    expect(expectParseError(bytes()).error).toBeInstanceOf(TruncatedDataError);
  });

  it("rejects trailing bytes after the declared entries", () => {
    const buf = bytes(1, K.KIND_U8, 0xff); // count=1, one u8, then a stray byte
    expect(expectParseError(buf).error).toBeInstanceOf(TrailingBytesError);
  });

  it("rejects an unknown kind byte", () => {
    const buf = bytes(1, 0x99);
    expect(expectParseError(buf).error).toBeInstanceOf(UnknownKindError);
  });

  it("rejects a truncated STRUCT ref list", () => {
    const buf = bytes(1, K.KIND_STRUCT, 3, 0, 1); // declares 3 refs, only 2 present
    expect(expectParseError(buf).error).toBeInstanceOf(TruncatedDataError);
  });

  describe("parseInlinePayload", () => {
    it("parses a recursive inline STRUCT payload", () => {
      const inline = bytes(K.KIND_STRUCT, 2, K.KIND_U8, K.KIND_U32);
      const entry = parseInlinePayload(inline);
      expect(entry.kind).toBe(K.KIND_STRUCT);
      expect(entry.refs).toHaveLength(2);
      // Inline refs are nested Entry objects, not numeric pool indices.
      expect(typeof entry.refs[0]).toBe("object");
      expect((entry.refs[0] as { kind: number }).kind).toBe(K.KIND_U8);
    });

    it("rejects trailing bytes in an inline payload", () => {
      const inline = bytes(K.KIND_U8, 0xff);
      let err: TypePoolDecoderThrow | undefined;
      try {
        parseInlinePayload(inline);
      } catch (e) {
        err = e as TypePoolDecoderThrow;
      }
      expect(err?.error).toBeInstanceOf(TrailingBytesError);
    });
  });
});
