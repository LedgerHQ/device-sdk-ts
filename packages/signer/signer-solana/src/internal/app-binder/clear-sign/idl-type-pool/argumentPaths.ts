import * as K from "./kinds";

/**
 * An argument path is the sequence of steps the decoder takes from the root to
 * a leaf. Each step's byte width is fixed by its parent kind (so the decoder can
 * locate steps without an in-band length), and step values are big-endian.
 * Wire format: `u8 step_count || <packed steps>`.
 */

/** Sentinel array index meaning "iterate every element" (`0xFFFF`). */
export const ARRAY_ITERATE_ALL = 0xffff;

/** A single packed step: `[parentKind, value, discKind | undefined]`. */
export type PathStep = readonly [
  parentKind: number,
  value: number,
  discKind: number | undefined,
];

/**
 * Thrown when a step value cannot be packed under its parent kind (e.g. an
 * array index exceeding `0xFFFF`, or an ENUM discriminator wider than `u64`).
 * The decoder treats this as "leaf has no addressable path" and skips it.
 */
export class PathPackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathPackError";
  }
}

// `parentKind -> step width in bytes` (undefined means "look up discKind").
const PARENT_KIND_STEP_WIDTH: ReadonlyMap<number, number | undefined> = new Map(
  [
    [K.KIND_STRUCT, 1],
    [K.KIND_TUPLE, 1],
    [K.KIND_ARRAY_FIXED, 2],
    [K.KIND_ARRAY_PREFIXED, 2],
    [K.KIND_ARRAY_REMAINDER, 2],
    [K.KIND_ENUM, undefined],
    [K.KIND_OPTION_DYNAMIC, 1],
    [K.KIND_OPTION_FIXED, 1],
    [K.KIND_OPTION_ZEROABLE, 1],
    [K.KIND_OPTION_REMAINDER, 1],
    [K.KIND_HIDDEN_PREFIX, 1],
    [K.KIND_HIDDEN_SUFFIX, 1],
  ],
);

const DISC_KIND_BYTE_WIDTH: ReadonlyMap<number, number> = new Map([
  [K.KIND_U8, 1],
  [K.KIND_U16, 2],
  [K.KIND_U32, 4],
  [K.KIND_U64, 8],
]);

/**
 * Return the byte width of one step under `parentKind`.
 *
 * For `ENUM` parents the caller must pass `discKind`. `SHORT_U16` is rejected —
 * argument-path steps must have a fixed BE width so the decoder can locate them
 * cursor-blind.
 */
export function stepWidthForParent(
  parentKind: number,
  discKind?: number,
): number {
  if (parentKind === K.KIND_ENUM) {
    if (discKind === undefined) {
      throw new PathPackError("ENUM parent requires discKind");
    }
    const width = DISC_KIND_BYTE_WIDTH.get(discKind);
    if (width === undefined) {
      throw new PathPackError(
        `unsupported ENUM disc_kind 0x${discKind
          .toString(16)
          .padStart(2, "0")} in argument path`,
      );
    }
    return width;
  }
  if (!PARENT_KIND_STEP_WIDTH.has(parentKind)) {
    throw new PathPackError(
      `argument-path step under parent kind 0x${parentKind
        .toString(16)
        .padStart(2, "0")} is undefined`,
    );
  }
  return PARENT_KIND_STEP_WIDTH.get(parentKind)!;
}

/** Encode a single step as the parent-kind-driven number of BE bytes. */
export function packStep(
  parentKind: number,
  value: number,
  discKind?: number,
): Uint8Array {
  const width = stepWidthForParent(parentKind, discKind);
  // Must be a non-negative, exactly-representable integer that fits in `width`.
  if (!Number.isSafeInteger(value) || value < 0 || value >= 2 ** (width * 8)) {
    throw new PathPackError(
      `step value ${value} does not fit in width ${width} for parent kind ` +
        `0x${parentKind.toString(16).padStart(2, "0")}`,
    );
  }
  const out = new Uint8Array(width);
  let remaining = value;
  for (let i = width - 1; i >= 0; i--) {
    // `% 256`, not `& 0xff`: bitwise ops coerce to int32 and would corrupt
    // values above 2^31 (e.g. a u64 enum discriminator step).
    out[i] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  return out;
}

/** @throws {PathPackError} when a step value can't be packed under its parent. */
export function packPath(steps: readonly PathStep[]): Uint8Array {
  if (steps.length > 0xff) {
    throw new PathPackError("argument paths cannot have more than 255 steps");
  }
  const chunks = steps.map(([parentKind, value, discKind]) =>
    packStep(parentKind, value, discKind),
  );
  const bodyLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const out = new Uint8Array(1 + bodyLength);
  out[0] = steps.length;
  let offset = 1;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Byte-equality of two packed paths. */
export function pathsEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}
