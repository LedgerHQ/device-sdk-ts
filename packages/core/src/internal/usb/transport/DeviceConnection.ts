import { Either } from "purify-ts";

import { SdkError } from "@api/Error";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";

export type SendApduFnType = (
  apdu: Uint8Array,
) => Promise<Either<SdkError, ApduResponse>>;

export interface DeviceConnection {
  sendApdu: SendApduFnType;
}
