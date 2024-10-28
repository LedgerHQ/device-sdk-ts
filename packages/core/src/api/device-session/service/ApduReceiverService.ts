import { type Either, type Maybe } from "purify-ts";

import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type SdkError } from "@api/Error";

export interface ApduReceiverService {
  handleFrame(apdu: Uint8Array): Either<SdkError, Maybe<ApduResponse>>;
}

export type ApduReceiverConstructorArgs = Partial<{
  channel: Maybe<Uint8Array>;
}>;

export type ApduReceiverServiceFactory = (
  args?: ApduReceiverConstructorArgs,
) => ApduReceiverService;
