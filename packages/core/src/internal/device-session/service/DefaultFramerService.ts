import { Maybe } from "purify-ts";
import { v4 } from "uuid";

import {
  APDU_DATA_SIZE,
  CHANNEL_SIZE,
  HEAD_TAG,
  HEAD_TAG_SIZE,
  INDEX_SIZE,
} from "@internal/device-session/data/FramerDataSource";
import { Frame } from "@internal/device-session/model/Frame";
import { FrameHeader } from "@internal/device-session/model/FrameHeader";

import { FramerService } from "./FramerService";

export type DefaultFramerServiceConstructorArgs = {
  frameSize: number;
  channel?: Maybe<Uint8Array>;
  padding?: boolean;
};

export class DefaultFramerService implements FramerService {
  protected frameSize: number;
  protected channel: Maybe<Uint8Array>;
  protected padding: boolean;

  constructor({
    frameSize,
    channel = Maybe.zero(),
    padding = false,
  }: DefaultFramerServiceConstructorArgs) {
    this.frameSize = frameSize;
    this.channel = channel;
    this.padding = padding;
  }

  /**
   * Get frame header size
   * @private
   * @param frameIndex
   */
  private getFrameHeaderSizeFromIndex(frameIndex: number): number {
    return (
      this.channel.caseOf({
        Just: () => CHANNEL_SIZE,
        Nothing: () => 0,
      }) +
      INDEX_SIZE +
      HEAD_TAG_SIZE +
      (frameIndex === 0 ? APDU_DATA_SIZE : 0)
    );
  }

  /**
   * Get frame offset
   * First frame has more bytes of header
   * Padding append means a 0 bytes is added at the end of each frame
   * @private
   * @param frameIndex
   */
  private getHeaderSizeSumFrom(frameIndex: number): number {
    let sum = this.getFrameHeaderSizeFromIndex(0);
    let i = 1;
    while (i < frameIndex) {
      sum += this.getFrameHeaderSizeFromIndex(i);
      i += 1;
    }
    return sum;
  }

  /**
   * Get frame header
   * @param frameIndex
   * @param apduSize
   * @private
   */
  private getFrameHeader(frameIndex: number, apduSize: number): FrameHeader {
    const header = new FrameHeader({
      uuid: v4(),
      channel: this.channel,
      headTag: new Uint8Array([HEAD_TAG]),
      index: new Uint8Array([Math.floor(frameIndex / 0xff), frameIndex & 0xff]),
      length: this.getFrameHeaderSizeFromIndex(frameIndex),
      dataSize: Maybe.zero(),
    });
    if (frameIndex === 0) {
      header.dataSize = Maybe.of(
        new Uint8Array([Math.floor(apduSize / 0xff), apduSize & 0xff]),
      );
    }
    return header;
  }

  /**
   * Get apdu frame at index
   * Split every {{PACKET_SIZE - HEADER_SIZE}} bytes of apdu
   * @param apdu
   * @param frameIndex
   * @private
   */
  private getFrameAtIndex(apdu: Uint8Array, frameIndex: number): Maybe<Frame> {
    const header = this.getFrameHeader(frameIndex, apdu.length);
    const frameOffset =
      frameIndex * this.frameSize - this.getHeaderSizeSumFrom(frameIndex);

    if (frameOffset > apdu.length) {
      return Maybe.zero();
    }
    if (header.length > this.frameSize) {
      return Maybe.zero();
    }
    const dataMaxSize = this.frameSize - header.length;
    const data = apdu.slice(
      frameIndex === 0 ? 0 : frameOffset,
      frameIndex === 0
        ? dataMaxSize
        : frameOffset + this.frameSize - header.length,
    );
    const frame = new Frame({
      header,
      data: this.padding
        ? new Uint8Array(dataMaxSize).fill(0)
        : new Uint8Array(data.length < dataMaxSize ? data.length : dataMaxSize),
    });
    frame.data.set(data, 0);
    return Maybe.of(frame);
  }

  /**
   * Get frames from apdu
   *
   * @param apdu
   */
  getFrames(apdu: Uint8Array): Frame[] {
    const frames: Frame[] = [];
    let count = 0;
    let frame = this.getFrameAtIndex(apdu, count);
    while (frame.isJust()) {
      frames.push(frame.extract());
      count += 1;
      frame = this.getFrameAtIndex(apdu, count);
    }
    return frames;
  }
}
