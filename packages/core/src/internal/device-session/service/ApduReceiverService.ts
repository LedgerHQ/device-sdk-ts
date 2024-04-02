import { Either, Maybe } from "purify-ts";

import { SdkError } from "@api/Error";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";

export interface ApduReceiverService {
  handleFrame(apdu: Uint8Array): Either<SdkError, Maybe<ApduResponse>>;
}
