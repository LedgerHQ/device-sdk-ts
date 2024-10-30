import { type DmkError } from "@api/Error";

export type PromptDeviceAccessError =
  | UsbHidTransportNotSupportedError
  | BleTransportNotSupportedError
  | NoAccessibleDeviceError;

export type ConnectError =
  | UnknownDeviceError
  | OpeningConnectionError
  | DeviceAlreadyConnectedError;

class GeneralDmkError implements DmkError {
  _tag = "GeneralDmkError";
  originalError?: unknown;
  constructor(err?: unknown) {
    if (err instanceof Error) {
      this.originalError = err;
    } else if (err !== undefined) {
      this.originalError = new Error(String(err));
    }
  }
}

export class DeviceNotRecognizedError extends GeneralDmkError {
  override readonly _tag = "DeviceNotRecognizedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class NoAccessibleDeviceError extends GeneralDmkError {
  override readonly _tag = "NoAccessibleDeviceError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class OpeningConnectionError extends GeneralDmkError {
  override readonly _tag = "ConnectionOpeningError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class UnknownDeviceError extends GeneralDmkError {
  override readonly _tag = "UnknownDeviceError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class TransportNotSupportedError extends GeneralDmkError {
  override readonly _tag = "TransportNotSupportedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class BleTransportNotSupportedError extends GeneralDmkError {
  override readonly _tag = "BleTransportNotSupportedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class UsbHidTransportNotSupportedError extends GeneralDmkError {
  override readonly _tag = "UsbHidTransportNotSupportedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class SendApduConcurrencyError extends GeneralDmkError {
  override readonly _tag = "SendApduConcurrencyError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class DisconnectError extends GeneralDmkError {
  override readonly _tag = "DisconnectError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class ReconnectionFailedError extends GeneralDmkError {
  override readonly _tag = "ReconnectionFailedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class HidSendReportError extends GeneralDmkError {
  override readonly _tag = "HidSendReportError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class DeviceNotInitializedError extends GeneralDmkError {
  override readonly _tag = "DeviceNotInitializedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class BleDeviceGattServerError extends GeneralDmkError {
  override readonly _tag = "BleDeviceGattServerError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class DeviceAlreadyConnectedError extends GeneralDmkError {
  override readonly _tag = "DeviceAlreadyDiscoveredError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
