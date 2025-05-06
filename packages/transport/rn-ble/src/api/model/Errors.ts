import {
  GeneralDmkError,
  OpeningConnectionError,
} from "@ledgerhq/device-management-kit";

export class BleTransportNotSupportedError extends GeneralDmkError {
  override readonly _tag = "BleTransportNotSupportedError";
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
export class DeviceConnectionNotFound extends GeneralDmkError {
  override readonly _tag = "DeviceConnectionNotFound";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
export class InternalDeviceNotFound extends GeneralDmkError {
  override readonly _tag = "InternalDeviceNotFound";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class BleNotSupported extends GeneralDmkError {
  override readonly _tag = "BleNotSupported";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class NoDeviceModelFoundError extends GeneralDmkError {
  override readonly _tag = "NoDeviceModelFoundError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class PairingRefusedError extends OpeningConnectionError {
  override readonly _tag = "PairingRefusedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class UnknownBleError extends GeneralDmkError {
  override readonly _tag = "UnknownBleError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class PeerRemovedPairingError extends OpeningConnectionError {
  override readonly _tag = "PeerRemovedPairingError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
