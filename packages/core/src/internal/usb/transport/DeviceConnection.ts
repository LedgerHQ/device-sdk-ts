import { Either } from "purify-ts";

import { ApduResponse } from "@api/device-session/ApduResponse";
import { SdkError } from "@api/Error";

export type SendApduFnType = (
  apdu: Uint8Array,
  triggersDisconnection?: boolean,
) => Promise<Either<SdkError, ApduResponse>>;

export interface DeviceConnection {
  sendApdu: SendApduFnType;
}
