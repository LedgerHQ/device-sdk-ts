import { SdkError } from "@root/src/api/Error";

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

export class ReceiverApduError implements SdkError {
  readonly _tag = "ReceiverApduError";
  originalError?: Error;

  constructor() {
    this.originalError = new Error("Unable to parse apdu");
  }
}

export class DeviceSessionNotFound implements SdkError {
  readonly _tag = "DeviceSessionNotFound";
  originalError?: Error;

  constructor(originalError?: Error) {
    this.originalError = originalError ?? new Error("Device session not found");
  }
}
