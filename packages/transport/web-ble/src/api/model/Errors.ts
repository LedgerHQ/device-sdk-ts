import { GeneralSdkError } from "@ledgerhq/device-management-kit";

export class BleTransportNotSupportedError extends GeneralSdkError {
  override readonly _tag = "BleTransportNotSupportedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
export class BleDeviceGattServerError extends GeneralSdkError {
  override readonly _tag = "BleDeviceGattServerError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
