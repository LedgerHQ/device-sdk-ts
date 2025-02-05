import { type Either } from "purify-ts";

import { type DeviceId } from "@api/device/DeviceModel";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type DmkError } from "@api/Error";

export type DisconnectHandler = (deviceId: DeviceId) => void;

export type SendApduResult = Either<DmkError, ApduResponse>;

export type SendApduFnType = (
  apdu: Uint8Array,
  triggersDisconnection?: boolean,
) => Promise<SendApduResult>;

export interface DeviceConnection {
  sendApdu: SendApduFnType;
}
