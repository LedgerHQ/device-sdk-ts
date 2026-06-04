import {
  bytes,
  optionDynamic,
  pool,
  struct,
  u8,
  u32,
} from "./__tests__/fixtures/builders";
import {
  JUPITER_DATA,
  JUPITER_IN_AMOUNT,
  JUPITER_POOL,
  JUPITER_ROOT,
} from "./__tests__/fixtures/jupiterRoute";
import { packPath } from "./argumentPaths";
import { decodeArgumentPath } from "./decodeArgumentPath";
import * as K from "./kinds";
import { TruncatedDataError } from "./TypePoolDecoderError";
import { type VariantCache } from "./types";

const EMPTY_CACHE: VariantCache = new Map();

describe("decodeArgumentPath", () => {
  it("returns the leaf value at a given path (jupiter inAmount)", () => {
    const path = packPath([[K.KIND_STRUCT, 2, undefined]]);
    const result = decodeArgumentPath(
      JUPITER_POOL,
      JUPITER_ROOT,
      EMPTY_CACHE,
      path,
      JUPITER_DATA,
    );
    expect(result.isRight()).toBe(true);
    const value = result.unsafeCoerce();
    expect(value.isJust()).toBe(true);
    expect(value.unsafeCoerce()).toBe(JUPITER_IN_AMOUNT);
  });

  it("returns Nothing for a path no leaf is emitted at", () => {
    // OPTION_DYNAMIC absent → inner leaf never emitted; path into it is empty.
    const p = pool([struct([1]), optionDynamic(K.KIND_U8, 2), u32()]);
    const path = packPath([
      [K.KIND_STRUCT, 0, undefined],
      [K.KIND_OPTION_DYNAMIC, 0, undefined],
    ]);
    const result = decodeArgumentPath(p, 0, EMPTY_CACHE, path, bytes(0));
    expect(result.unsafeCoerce().isNothing()).toBe(true);
  });

  it("preserves falsy leaf values (0) as Just", () => {
    const p = pool([struct([1]), u8()]);
    const path = packPath([[K.KIND_STRUCT, 0, undefined]]);
    const result = decodeArgumentPath(p, 0, EMPTY_CACHE, path, bytes(0));
    expect(result.unsafeCoerce().extract()).toBe(0);
  });

  it("surfaces malformed input as a typed Left", () => {
    const p = pool([struct([1]), u32()]);
    const path = packPath([[K.KIND_STRUCT, 0, undefined]]);
    const result = decodeArgumentPath(p, 0, EMPTY_CACHE, path, bytes(1, 2));
    expect(result.isLeft()).toBe(true);
    result.ifLeft((e) => expect(e).toBeInstanceOf(TruncatedDataError));
  });
});
