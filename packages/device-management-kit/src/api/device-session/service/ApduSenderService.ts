import { type Maybe } from "purify-ts";

import { type Frame } from "@internal/device-session/model/Frame";

export interface ApduSenderService {
  getFrames: (apdu: Uint8Array) => Frame[];
}
export type ApduSenderServiceConstructorArgs = {
  frameSize: number;
  channel?: Maybe<Uint8Array>;
  padding?: boolean;
};

export type ApduSenderServiceFactory = (
  args: ApduSenderServiceConstructorArgs,
) => ApduSenderService;
