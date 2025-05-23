import { type Either } from "purify-ts";

import { type DeviceId } from "@api/device/DeviceModel";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type DmkError } from "@api/Error";
import { Observable } from "rxjs";

export type DisconnectHandler = (deviceId: DeviceId) => void;

export type SendApduResult = Either<DmkError, ApduResponse>;

export type SendApduFnType = (
  apdu: Uint8Array,
  triggersDisconnection?: boolean,
  abortTimeout?: number,
) => Promise<SendApduResult>;

export type ExchangeBulkApdusFnType = (
  apdus: Uint8Array[],
) => Promise<Observable<{ currentIndex: number } | { result: SendApduResult }>>;

export interface DeviceConnection {
  sendApdu: SendApduFnType;
}
