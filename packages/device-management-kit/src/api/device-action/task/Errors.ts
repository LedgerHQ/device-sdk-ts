import { type DmkError } from "@api/Error";

export class InvalidGetFirmwareMetadataResponseError implements DmkError {
  readonly _tag = "InvalidGetFirmwareMetadataResponseError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(
      message ?? "Invalid Firmware Metadata response error.",
    );
  }
}

export class GetApplicationsMetadataTaskError implements DmkError {
  readonly _tag = "GetApplicationsMetadataTaskError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(
      message ?? "Failed to get applications metadata.",
    );
  }
}
