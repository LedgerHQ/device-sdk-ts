import { SdkError } from "@api/Error";

export class InvalidStatusWordError implements SdkError {
  readonly _tag = "InvalidStatusWordError";
  originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid status word.");
  }
}

export class InvalidBatteryStatusTypeError implements SdkError {
  readonly _tag = "InvalidBatteryStatusTypeError";
  originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid battery status type.");
  }
}

export class InvalidBatteryDataError implements SdkError {
  readonly _tag = "InvalidBatteryDataError";
  originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid battery data.");
  }
}

export class InvalidBatteryFlagsError implements SdkError {
  readonly _tag = "InvalidBatteryFlagsError";
  originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid battery flags.");
  }
}

export class InvalidResponseFormatError implements SdkError {
  readonly _tag = "InvalidResponseFormatError";
  originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid response format.");
  }
}
