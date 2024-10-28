import { GeneralSdkError, SdkError } from "@root/src/api/Error";

export class FramerOverflowError implements SdkError {
  readonly _tag = "FramerOverflowError";
  originalError?: Error;
  constructor() {
    this.originalError = new Error(
      "Frame header length is greater than frame size",
    );
  }
}

export class FramerApduError implements SdkError {
  readonly _tag = "FramerApduError";
  originalError?: Error;

  constructor() {
    this.originalError = new Error("Frame offset is greater than apdu length");
  }
}

export class FrameSizeUnsetError extends GeneralSdkError {
  override _tag = "FrameSizeUnsetError";
}

export class ReceiverApduError implements SdkError {
  readonly _tag = "ReceiverApduError";
  originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Unable to parse apdu");
  }
}

export class DeviceSessionNotFound implements SdkError {
  readonly _tag = "DeviceSessionNotFound";
  originalError?: Error;

  constructor(originalError?: Error) {
    this.originalError = originalError ?? new Error("Device session not found");
  }
}

export class DeviceSessionRefresherError implements SdkError {
  readonly _tag = "DeviceSessionRefresherError";
  originalError?: Error;

  constructor(originalError?: Error) {
    this.originalError =
      originalError ?? new Error("Device session refresher error");
  }
}
