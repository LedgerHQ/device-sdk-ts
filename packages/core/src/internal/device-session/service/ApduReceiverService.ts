import { Either, Maybe } from "purify-ts";

import { ApduResponse } from "@internal/device-session/model/ApduResponse";
import { ReceiverApduError } from "@internal/device-session/model/Errors";

export interface ApduReceiverService {
  handleFrame(apdu: Uint8Array): Either<ReceiverApduError, Maybe<ApduResponse>>;
}
