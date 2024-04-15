import { SdkError } from "@api/Error";

import { APDU_MAX_PAYLOAD } from "./ApduBuilder";

interface SdkAppBuilderError extends SdkError {
  message: string;
}

export class InvalidValueError implements SdkAppBuilderError {
  readonly _tag = "InvalidValue";
  originalError?: Error;
  message: string;
  constructor(valueType: string, value?: string) {
    this.message = `Invalid value for ${valueType}: ${value}`;
  }
}

export class ValueOverflowError implements SdkAppBuilderError {
  readonly _tag = "ValueOverflow";
  originalError?: Error;
  message: string;
  constructor(value: string, max: number = APDU_MAX_PAYLOAD) {
    this.message = `Value overflow for ${value}, max is ${max}`;
  }
}

export class DataOverflowError implements SdkAppBuilderError {
  readonly _tag = "DataOverflow";
  message: string;
  originalError?: Error;
  constructor(value: string, remaining = 0) {
    this.message =
      remaining === 0
        ? `this.data is already full (value: ${value})`
        : `this.data will overflow with "${value}", remaining bytes: ${remaining}`;
  }
}

export class HexaStringEncodeError implements SdkAppBuilderError {
  readonly _tag = "HexaString";
  message: string;
  originalError?: Error;
  constructor(value: string) {
    this.message = `Invalid encoded hexa string or length is null: ${value}`;
  }
}

export type AppBuilderError =
  | InvalidValueError
  | ValueOverflowError
  | DataOverflowError
  | HexaStringEncodeError;
