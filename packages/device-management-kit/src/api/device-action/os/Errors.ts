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

export class UnsupportedFirmwareDAError implements DmkError {
  readonly _tag = "UnsupportedFirmwareDAError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Unknown error.");
  }
}

export class MissingDataDAError implements DmkError {
  readonly _tag = "MissingDataDAError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(
      message ?? "Missing data for device action.",
    );
  }
}

export class InvalidLKRPCredentialsDAError implements DmkError {
  readonly _tag = "InvalidLKRPCredentialsDAError";
  readonly originalError?: Error;

  constructor() {
    this.originalError = new Error(
      "The public key doesn't match the provided trustchain Id.",
    );
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
