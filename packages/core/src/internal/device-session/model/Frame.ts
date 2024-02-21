import { FrameHeader } from "@internal/device-session/model/FrameHeader";

type FrameConstructorArgs = {
  header: FrameHeader;
  data: Uint8Array;
};

export class Frame {
  header: FrameHeader;
  data: Uint8Array;
  constructor({ header, data }: FrameConstructorArgs) {
    this.header = header;
    this.data = data;
  }
  toString(): string {
    return JSON.stringify(
      { header: this.header.toString(), data: this.data.toString() },
      null,
      2,
    );
  }
}
