import { Maybe } from "purify-ts";

type FrameHeaderConstructorArgs = {
  uuid: string;
  channel: Maybe<Uint8Array>;
  headTag: Uint8Array;
  index: Uint8Array;
  length: number;
  dataSize: Maybe<Uint8Array>;
};

export class FrameHeader {
  protected _uuid: string;
  protected _channel: Maybe<Uint8Array>;
  protected _headTag: Uint8Array;
  protected _index: Uint8Array;
  protected _length: number;
  protected _dataSize: Maybe<Uint8Array>;
  constructor({
    uuid,
    dataSize,
    index,
    headTag,
    length,
    channel,
  }: FrameHeaderConstructorArgs) {
    this._uuid = uuid;
    this._dataSize = dataSize;
    this._index = index;
    this._headTag = headTag;
    this._length = length;
    this._channel = channel;
  }
  setDataSize(dataSize: Maybe<Uint8Array>): FrameHeader {
    this._dataSize = dataSize;
    return this;
  }
  getLength(): number {
    return this._length;
  }
  toString(): string {
    return JSON.stringify({
      uuid: this._uuid.toString(),
      dataSize: this._dataSize.extract()?.toString(),
      index: this._index.toString(),
      headTag: this._headTag.toString(),
      length: this._length.toString(),
      channel: this._channel.extract()?.toString(),
    });
  }
  getRawData(): Uint8Array {
    return new Uint8Array([
      ...this._channel.caseOf({
        Just: (channel) => [...channel],
        Nothing: () => [],
      }),
      ...this._headTag,
      ...this._index,
      ...this._dataSize.caseOf({
        Just: (dataSize) => [...dataSize],
        Nothing: () => [],
      }),
    ]);
  }
}
