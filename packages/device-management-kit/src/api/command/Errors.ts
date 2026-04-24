import { type DmkError } from "@api/Error";

export class InvalidStatusWordError implements DmkError {
  readonly _tag = "InvalidStatusWordError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid status word.");
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
