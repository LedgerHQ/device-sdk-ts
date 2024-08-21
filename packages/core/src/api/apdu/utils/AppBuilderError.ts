import { SdkError } from "@api/Error";

import { APDU_MAX_PAYLOAD } from "./ApduBuilder";

interface SdkAppBuilderError extends SdkError {
  readonly message: string;
}

export class ValueOverflowError implements SdkAppBuilderError {
  readonly _tag = "ValueOverflow";
  readonly originalError?: Error;
  readonly message: string;
  constructor(value: string, max: number = APDU_MAX_PAYLOAD) {
    this.message = `Value overflow for ${value}, max is ${max}`;
  }
}

export class DataOverflowError implements SdkAppBuilderError {
  readonly _tag = "DataOverflow";
  readonly message: string;
  readonly originalError?: Error;
  constructor(value: string, remaining = 0) {
    this.message =
      remaining === 0
        ? `this.data is already full (value: ${value})`
        : `this.data will overflow with "${value}", remaining bytes: ${remaining}`;
  }
}

export class HexaStringEncodeError implements SdkAppBuilderError {
  readonly _tag = "HexaString";
  readonly message: string;
  readonly originalError?: Error;
  constructor(value: string) {
    this.message = `Invalid encoded hexa string or length is null: ${value}`;
  }
}

/**
 * Type for all possible errors that can be thrown by the AppBuilder.
 */
export type AppBuilderError =
  | ValueOverflowError
  | DataOverflowError
  | HexaStringEncodeError;
