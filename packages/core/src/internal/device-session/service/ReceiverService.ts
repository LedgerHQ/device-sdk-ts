import { Maybe } from "purify-ts";

import { ApduResponse } from "@internal/device-session/model/ApduResponse";

export interface ReceiverService {
  handleFrame(apdu: Uint8Array): Maybe<ApduResponse>;
}
