import { SdkError } from "@api/Error";

export type PromptDeviceAccessError =
  | UsbHidTransportNotSupportedError
  | NoAccessibleDeviceError;

export type ConnectError = UnknownDeviceError | OpeningConnectionError;

export class DeviceNotRecognizedError implements SdkError {
  readonly _tag = "DeviceNotRecognizedError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class NoAccessibleDeviceError implements SdkError {
  readonly _tag = "NoAccessibleDeviceError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class OpeningConnectionError implements SdkError {
  readonly _tag = "ConnectionOpeningError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class UnknownDeviceError implements SdkError {
  readonly _tag = "UnknownDeviceError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class UsbHidTransportNotSupportedError implements SdkError {
  readonly _tag = "UsbHidTransportNotSupportedError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class SendApduConcurrencyError implements SdkError {
  readonly _tag = "SendApduConcurrencyError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}
