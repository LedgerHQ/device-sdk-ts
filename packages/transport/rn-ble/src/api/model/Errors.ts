import { GeneralDmkError } from "@ledgerhq/device-management-kit";

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
