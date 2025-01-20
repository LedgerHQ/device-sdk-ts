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
