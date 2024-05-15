import { Either, Maybe } from "purify-ts";

import { ApduResponse } from "@api/device-session/ApduResponse";
import { SdkError } from "@api/Error";

export interface ApduReceiverService {
  handleFrame(apdu: Uint8Array): Either<SdkError, Maybe<ApduResponse>>;
}
