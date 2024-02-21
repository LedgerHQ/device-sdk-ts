import { Either, Left, Right } from "purify-ts";
import { v4 } from "uuid";

import {
  APDU_DATA_SIZE,
  HEAD_TAG,
  HEAD_TAG_SIZE,
  INDEX_SIZE,
} from "@internal/device-session/data/FramerDataSource";
import { Frame } from "@internal/device-session/model/Frame";
import { FrameHeader } from "@internal/device-session/model/FrameHeader";

import { FramerService } from "./FramerService";

export type ApduFramerServiceConstructorArgs = {
  packetSize: number;
  channel?: Uint8Array;
  padding?: boolean;
};

export class DefaultFramerService implements FramerService {
  protected packetSize: number;
  protected channel: Uint8Array;
  protected padding: boolean;

  constructor({
    packetSize,
    channel = new Uint8Array([]),
    padding = false,
  }: ApduFramerServiceConstructorArgs) {
    this.packetSize = packetSize;
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
      this.channel.length +
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
      dataSize: Left(undefined),
    });
    if (frameIndex === 0) {
      header.dataSize = Right(
        new Uint8Array([Math.floor(apduSize / 0xff), apduSize & 0xff]),
      );
    }
    return header;
  }

  /**
   * Get next apdu frame
   * Split every {{PACKET_SIZE}} bytes of data
   * @param apdu
   * @param frameIndex
   * @private
   */
  private getFrameAtIndex(
    apdu: Uint8Array,
    frameIndex: number,
  ): Either<null, Frame> {
    const header = this.getFrameHeader(frameIndex, apdu.length);
    const frameOffset =
      frameIndex * this.packetSize - this.getHeaderSizeSumFrom(frameIndex);

    if (frameOffset > apdu.length) {
      return Left(null);
    }
    if (header.length > this.packetSize) {
      return Left(null);
    }
    const frameDataMaxSize = this.packetSize - header.length;
    const frame = new Frame({
      header,
      data: this.padding
        ? new Uint8Array(frameDataMaxSize).fill(0)
        : new Uint8Array(
            apdu.length < frameDataMaxSize ? apdu.length : frameDataMaxSize,
          ),
    });
    frame.data.set(
      apdu.slice(
        frameIndex === 0 ? 0 : frameOffset,
        frameIndex === 0
          ? frameDataMaxSize
          : frameOffset + this.packetSize - header.length,
      ),
      0,
    );
    return Right(frame);
  }

  /**
   * Get frames from apdu and data (optional)
   *
   * @param apdu
   */
  getFrames(apdu: Uint8Array): Frame[] {
    const frames: Frame[] = [];
    let count = 0;
    let frame = this.getFrameAtIndex(apdu, count);
    while (frame.isRight()) {
      frames.push(frame.extract());
      count += 1;
      frame = this.getFrameAtIndex(apdu, count);
    }
    return frames;
  }
}
