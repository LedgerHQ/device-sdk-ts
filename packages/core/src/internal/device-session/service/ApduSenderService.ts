import { Frame } from "@internal/device-session/model/Frame";

export interface ApduSenderService {
  setFrameSize: (frameSize: number) => void;
  getFrames: (apdu: Uint8Array) => Frame[];
}
