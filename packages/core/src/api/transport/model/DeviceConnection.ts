import { type Either } from "purify-ts";

import { type DeviceId } from "@api/device/DeviceModel";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type SdkError } from "@api/Error";

export type DisconnectHandler = (deviceId: DeviceId) => void;

export type SendApduFnType = (
  apdu: Uint8Array,
  triggersDisconnection?: boolean,
) => Promise<Either<SdkError, ApduResponse>>;

export interface DeviceConnection {
  sendApdu: SendApduFnType;
}