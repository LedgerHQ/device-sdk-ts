import { type DmkError } from "@api/Error";

export class DeviceNotOnboardedError implements DmkError {
  readonly _tag = "DeviceNotOnboardedError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Device not onboarded.");
  }
}

export class DeviceLockedError implements DmkError {
  readonly _tag = "DeviceLockedError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Device locked.");
  }
}

export class OutOfMemoryDAError implements DmkError {
  readonly _tag = "OutOfMemoryDAError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Unknown error.");
  }
}

export class UnknownDAError implements DmkError {
  readonly _tag = "UnknownDAError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Unknown error.");
  }
}
