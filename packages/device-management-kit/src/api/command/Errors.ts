import { type DmkError } from "@api/Error";

export class InvalidStatusWordError implements DmkError {
  readonly _tag = "InvalidStatusWordError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid status word.");
  }
}

export class InvalidBatteryStatusTypeError implements DmkError {
  readonly _tag = "InvalidBatteryStatusTypeError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid battery status type.");
  }
}

export class InvalidBatteryDataError implements DmkError {
  readonly _tag = "InvalidBatteryDataError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid battery data.");
  }
}

export class InvalidBatteryFlagsError implements DmkError {
  readonly _tag = "InvalidBatteryFlagsError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid battery flags.");
  }
}

export class InvalidResponseFormatError implements DmkError {
  readonly _tag = "InvalidResponseFormatError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid response format.");
  }
}

export class InvalidGetFirmwareMetadataResponseError implements DmkError {
  readonly _tag = "InvalidGetFirmwareMetadataResponseError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(
      message ?? "Invalid Firmware Metadata response error.",
    );
  }
}
