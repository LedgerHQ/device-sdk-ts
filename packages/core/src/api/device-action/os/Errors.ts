import { SdkError } from "@api/Error";

export class DeviceNotOnboardedError implements SdkError {
  readonly _tag = "DeviceNotOnboardedError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Device not onboarded.");
  }
}

export class DeviceLockedError implements SdkError {
  readonly _tag = "DeviceLockedError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Device locked.");
  }
}

export class UnknownDAError implements SdkError {
  readonly _tag = "UnknownDAError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Unknown error.");
  }
}
