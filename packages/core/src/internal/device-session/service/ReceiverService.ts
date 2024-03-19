import { Maybe } from "purify-ts";

import { Frame } from "@internal/device-session/model/Frame";

export interface ReciverService {
  getApdu: (frame: Frame) => Maybe<Uint8Array>;
}
