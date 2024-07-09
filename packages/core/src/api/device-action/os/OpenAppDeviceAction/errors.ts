import { SdkError } from "@api/Error";

export class DeviceNotOnboardedError implements SdkError {
  readonly _tag = "DeviceNotOnboardedError";
  originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Device not onboarded.");
  }
}

export class DeviceLockedError implements SdkError {
  readonly _tag = "DeviceLockedError";
  originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Device locked.");
  }
}

export class UnknownOpenAppDAError implements SdkError {
  readonly _tag = "UnknownOpenAppDAError";
  originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Unknown error.");
  }
}

export class OpenAppRejectedError implements SdkError {
  readonly _tag = "OpenAppRejectedError";
  originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Open app rejected.");
  }
}

// TODO: open app rejected error (also we should already have a similar error in the open app command parsing)

// TODO: app not installed error (same as above)
