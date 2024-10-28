import { type SdkError } from "@api/Error";
import { type DeviceAlreadyConnectedError } from "@internal/transport/ble/model/Errors";

export type ConnectError =
  | UnknownDeviceError
  | OpeningConnectionError
  | DeviceAlreadyConnectedError;

export class GeneralSdkError implements SdkError {
  _tag = "GeneralSdkError";
  originalError?: unknown;
  constructor(err?: unknown) {
    if (err instanceof Error) {
      this.originalError = err;
    } else if (err !== undefined) {
      this.originalError = new Error(String(err));
    }
  }
}

export class DeviceNotRecognizedError extends GeneralSdkError {
  override readonly _tag = "DeviceNotRecognizedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class NoAccessibleDeviceError extends GeneralSdkError {
  override readonly _tag = "NoAccessibleDeviceError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class OpeningConnectionError extends GeneralSdkError {
  override readonly _tag = "ConnectionOpeningError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class UnknownDeviceError extends GeneralSdkError {
  override readonly _tag = "UnknownDeviceError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class TransportNotSupportedError extends GeneralSdkError {
  override readonly _tag = "TransportNotSupportedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class SendApduConcurrencyError extends GeneralSdkError {
  override readonly _tag = "SendApduConcurrencyError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class DisconnectError extends GeneralSdkError {
  override readonly _tag = "DisconnectError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class ReconnectionFailedError extends GeneralSdkError {
  override readonly _tag = "ReconnectionFailedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class DeviceNotInitializedError extends GeneralSdkError {
  override readonly _tag = "DeviceNotInitializedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class NoTransportsProvidedError extends GeneralSdkError {
  override readonly _tag = "NoTransportsProvidedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class TransportAlreadyExistsError extends GeneralSdkError {
  override readonly _tag = "TransportAlreadyExistsError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
