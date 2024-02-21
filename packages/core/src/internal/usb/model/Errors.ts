export type PromptDeviceAccessError =
  | UsbHidTransportNotSupportedError
  | NoAccessibleDeviceError;

export type ConnectError = UnknownDeviceError | OpeningConnectionError;

export class DeviceNotRecognizedError {
  readonly _tag = "DeviceNotRecognizedError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class NoAccessibleDeviceError {
  readonly _tag = "NoAccessibleDeviceError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class OpeningConnectionError {
  readonly _tag = "ConnectionOpeningError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class UnknownDeviceError {
  readonly _tag = "UnknownDeviceError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}

export class UsbHidTransportNotSupportedError {
  readonly _tag = "UsbHidTransportNotSupportedError";
  originalError?: Error;
  constructor(readonly err?: Error) {
    this.originalError = err;
  }
}
