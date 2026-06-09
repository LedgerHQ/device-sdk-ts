import { type DmkError } from "@ledgerhq/device-management-kit";

/** Guards against recursive type-pool cycles that would overflow the stack. */
export const MAX_DECODE_DEPTH = 64;

/** Guards against adversarial length prefixes / remainder loops. */
export const MAX_DECODE_NODE_VISITS = 100_000;

/** Raised when a read or descriptor parse runs past the end of its buffer. */
export class TruncatedDataError implements DmkError {
  readonly _tag = "TruncatedDataError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(`Truncated IDL type-pool data: ${message}`);
  }
}

/** Raised when decoded bytes are a malformed or unrepresentable value. */
export class MalformedDataError implements DmkError {
  readonly _tag = "MalformedDataError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(`Malformed IDL type-pool data: ${message}`);
  }
}

/** Raised when a kind byte is not part of the supported kind table. */
export class UnknownKindError implements DmkError {
  readonly _tag = "UnknownKindError";
  readonly originalError: Error;

  constructor(kind: number) {
    this.originalError = new Error(
      `Unknown IDL type-pool kind 0x${kind.toString(16).padStart(2, "0")}.`,
    );
  }
}

/** Raised when a pool entry references an index outside the pool. */
export class PoolIndexOutOfRangeError implements DmkError {
  readonly _tag = "PoolIndexOutOfRangeError";
  readonly originalError: Error;

  constructor(index: number, poolSize: number) {
    this.originalError = new Error(
      `Type-pool ref ${index} out of range (pool has ${poolSize} entries).`,
    );
  }
}

/** Raised when the trailing bytes of a pool / inline payload are not consumed. */
export class TrailingBytesError implements DmkError {
  readonly _tag = "TrailingBytesError";
  readonly originalError: Error;

  constructor(remaining: number, context: string) {
    this.originalError = new Error(
      `${remaining} trailing byte(s) in ${context}.`,
    );
  }
}

/** Raised when a kind is structurally valid but unsupported in this context. */
export class UnsupportedKindError implements DmkError {
  readonly _tag = "UnsupportedKindError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(message);
  }
}

/** Raised when an ENUM_VARIANT payload descriptor is malformed. */
export class InvalidVariantPayloadError implements DmkError {
  readonly _tag = "InvalidVariantPayloadError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(`Invalid ENUM_VARIANT payload: ${message}`);
  }
}

/** Raised when an ARRAY_REMAINDER element consumes no bytes (would loop forever). */
export class NoProgressError implements DmkError {
  readonly _tag = "NoProgressError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(message);
  }
}

/** Raised when the decode exceeds its depth or node-visit budget. */
export class DecodeBudgetExceededError implements DmkError {
  readonly _tag = "DecodeBudgetExceededError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(`Decode budget exceeded: ${message}`);
  }
}

export type TypePoolDecoderError =
  | TruncatedDataError
  | MalformedDataError
  | UnknownKindError
  | PoolIndexOutOfRangeError
  | TrailingBytesError
  | UnsupportedKindError
  | InvalidVariantPayloadError
  | NoProgressError
  | DecodeBudgetExceededError;

/**
 * Internal exception used to unwind the recursive decoder / parser; caught at
 * the public boundary and surfaced as a `Left`. Never escapes the module.
 */
export class TypePoolDecoderThrow extends Error {
  constructor(readonly error: TypePoolDecoderError) {
    super(error.originalError.message);
    this.name = "TypePoolDecoderThrow";
  }
}

/** Throw a typed decoder error from inside the recursive routines. */
export function fail(error: TypePoolDecoderError): never {
  throw new TypePoolDecoderThrow(error);
}
