import { Frame } from "@internal/device-session/model/Frame";

export interface ApduSenderService {
  getFrames: (apdu: Uint8Array) => Frame[];
}
