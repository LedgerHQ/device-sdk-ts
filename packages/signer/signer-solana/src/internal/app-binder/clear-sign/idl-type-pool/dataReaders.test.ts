import { bytes } from "./__tests__/fixtures/builders";
import { DefaultDataReader, fixedSizeOf } from "./dataReaders";
import * as K from "./kinds";
import {
  MalformedDataError,
  TruncatedDataError,
  TypePoolDecoderThrow,
  UnsupportedKindError,
} from "./TypePoolDecoderError";
import { type Entry, type Ref } from "./types";

const reader = new DefaultDataReader();

/** Capture the TypePoolDecoderError a reader throws internally (via TypePoolDecoderThrow). */
function caughtError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    if (error instanceof TypePoolDecoderThrow) return error.error;
    throw error;
  }
  throw new Error("expected the reader to throw");
}

describe("DefaultDataReader", () => {
  describe("readUnsigned", () => {
    it("reads fixed-width unsigned integers little-endian", () => {
      expect(reader.readUnsigned(bytes(0x2a), 0, K.KIND_U8)).toEqual([0x2a, 1]);
      expect(reader.readUnsigned(bytes(0x34, 0x12), 0, K.KIND_U16)).toEqual([
        0x1234, 2,
      ]);
    });

    it("decodes a SHORT_U16 varint (1-3 bytes)", () => {
      expect(reader.readUnsigned(bytes(0x7f), 0, K.KIND_SHORT_U16)).toEqual([
        127, 1,
      ]);
      expect(
        reader.readUnsigned(bytes(0xac, 0x02), 0, K.KIND_SHORT_U16),
      ).toEqual([300, 2]);
    });

    it("rejects a non-unsigned kind", () => {
      expect(
        caughtError(() => reader.readUnsigned(bytes(0x01), 0, K.KIND_I8)),
      ).toBeInstanceOf(UnsupportedKindError);
    });

    it("rejects a truncated read", () => {
      expect(
        caughtError(() => reader.readUnsigned(bytes(0x01), 0, K.KIND_U32)),
      ).toBeInstanceOf(TruncatedDataError);
    });

    it("fails closed on an overlong SHORT_U16 (continuation bit past 3 bytes)", () => {
      expect(
        caughtError(() =>
          reader.readUnsigned(bytes(0x80, 0x80, 0x80), 0, K.KIND_SHORT_U16),
        ),
      ).toBeInstanceOf(MalformedDataError);
    });

    it("fails closed on an unsigned value above MAX_SAFE_INTEGER", () => {
      // u64 = 0xFFFFFFFFFFFFFFFF is not safely representable as a number.
      const eightBytes = bytes(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
      expect(
        caughtError(() => reader.readUnsigned(eightBytes, 0, K.KIND_U64)),
      ).toBeInstanceOf(MalformedDataError);
    });

    it("reads the largest safely-representable unsigned value", () => {
      // 2^53 - 1 = 0x1FFFFFFFFFFFFF, little-endian over 8 bytes.
      const maxSafe = bytes(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1f, 0x00);
      expect(reader.readUnsigned(maxSafe, 0, K.KIND_U64)).toEqual([
        Number.MAX_SAFE_INTEGER,
        8,
      ]);
    });
  });

  describe("readPrimitive", () => {
    it("returns 64-bit integers as bigint", () => {
      const data = bytes(0x00, 0x74, 0x3b, 0xa4, 0x0b, 0x00, 0x00, 0x00);
      expect(reader.readPrimitive(data, 0, K.KIND_U64)).toEqual([
        50_000_000_000n,
        8,
      ]);
    });

    it("sign-extends signed integers", () => {
      expect(reader.readPrimitive(bytes(0xff), 0, K.KIND_I8)).toEqual([-1, 1]);
    });

    it("decodes a PUBKEY_32 as base58", () => {
      const [value] = reader.readPrimitive(
        new Uint8Array(32),
        0,
        K.KIND_PUBKEY_32,
      );
      expect(value).toBe("11111111111111111111111111111111");
    });

    it("encodes PUBKEY_32 via the injected Bs58Encoder", () => {
      const calls: Uint8Array[] = [];
      const fakeEncoder = {
        encode: (data: Uint8Array) => {
          calls.push(data);
          return "FAKE_PUBKEY";
        },
        decode: () => new Uint8Array(),
      };
      const injectedReader = new DefaultDataReader(fakeEncoder);
      const [value] = injectedReader.readPrimitive(
        new Uint8Array(32),
        0,
        K.KIND_PUBKEY_32,
      );
      expect(value).toBe("FAKE_PUBKEY");
      expect(calls).toHaveLength(1);
    });

    it("reads booleans", () => {
      expect(reader.readPrimitive(bytes(0), 0, K.KIND_BOOL_U8)[0]).toBe(false);
      expect(reader.readPrimitive(bytes(9), 0, K.KIND_BOOL_U8)[0]).toBe(true);
    });
  });

  describe("decodeString", () => {
    it("decodes UTF-8 by default", () => {
      expect(reader.decodeString(bytes(0x68, 0x69), K.ENCODING_UTF8)).toBe(
        "hi",
      );
    });

    it("renders base16 as hex", () => {
      expect(reader.decodeString(bytes(0xde, 0xad), K.ENCODING_BASE16)).toBe(
        "dead",
      );
    });
  });
});

describe("fixedSizeOf", () => {
  const resolve =
    (pool: Entry[]) =>
    (ref: Ref): Entry =>
      typeof ref === "number" ? pool[ref]! : ref;

  it("sums fixed-size struct fields", () => {
    const pool: Entry[] = [
      { kind: K.KIND_STRUCT, refs: [1, 2] },
      { kind: K.KIND_U8, refs: [] },
      { kind: K.KIND_U32, refs: [] },
    ];
    expect(fixedSizeOf(pool[0]!, resolve(pool))).toBe(5);
  });

  it("returns undefined for a variable-size entry", () => {
    const pool: Entry[] = [
      { kind: K.KIND_ARRAY_PREFIXED, lenKind: K.KIND_U32, refs: [1] },
      { kind: K.KIND_U8, refs: [] },
    ];
    expect(fixedSizeOf(pool[0]!, resolve(pool))).toBeUndefined();
  });

  it("accounts for the OPTION_FIXED flag plus inner size", () => {
    const pool: Entry[] = [
      { kind: K.KIND_OPTION_FIXED, flagKind: K.KIND_U8, refs: [1] },
      { kind: K.KIND_U32, refs: [] },
    ];
    expect(fixedSizeOf(pool[0]!, resolve(pool))).toBe(5);
  });
});
