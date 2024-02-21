import { Either } from "purify-ts";

type FrameHeaderConstructorArgs = {
  uuid: string;
  channel?: Uint8Array;
  headTag: Uint8Array;
  index: Uint8Array;
  length: number;
  dataSize: Either<undefined, Uint8Array>;
};

export class FrameHeader {
  uuid: string;
  channel: Uint8Array;
  headTag: Uint8Array;
  index: Uint8Array;
  length: number;
  dataSize: Either<undefined, Uint8Array>;
  constructor({
    uuid,
    dataSize,
    index,
    headTag,
    length,
    channel = new Uint8Array([]),
  }: FrameHeaderConstructorArgs) {
    this.uuid = uuid;
    this.dataSize = dataSize;
    this.index = index;
    this.headTag = headTag;
    this.length = length;
    this.channel = channel;
  }
  toString(): string {
    return JSON.stringify({
      uuid: this.uuid.toString(),
      dataSize: this.dataSize?.toString() ?? "",
      index: this.index.toString(),
      headTag: this.headTag.toString(),
      length: this.length.toString(),
      channel: this.channel.toString(),
    });
  }
}
