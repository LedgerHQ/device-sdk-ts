import { GeneralSdkError } from "@api/transport/model/Errors";

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

export class DeviceAlreadyConnectedError extends GeneralSdkError {
  override readonly _tag = "DeviceAlreadyDiscoveredError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
