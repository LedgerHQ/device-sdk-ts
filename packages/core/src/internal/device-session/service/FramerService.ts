import { Frame } from "@internal/device-session/model/Frame";

export interface FramerService {
  getFrames: (apdu: Uint8Array) => Frame[];
}
