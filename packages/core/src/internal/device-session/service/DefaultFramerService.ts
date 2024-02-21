import { inject, injectable } from "inversify";
import { Either, Left, Maybe, Right } from "purify-ts";
import { v4 } from "uuid";

import {
  APDU_DATA_SIZE,
  CHANNEL_SIZE,
  HEAD_TAG,
  HEAD_TAG_SIZE,
  INDEX_SIZE,
} from "@internal/device-session/data/FramerConst";
import {
  FramerApduError,
  FramerOverflowError,
} from "@internal/device-session/model/Errors";
import { Frame } from "@internal/device-session/model/Frame";
import { FrameHeader } from "@internal/device-session/model/FrameHeader";
import { FramerUtils } from "@internal/device-session/utils/FramerUtils";
import { types as loggerTypes } from "@internal/logger/di/loggerTypes";
import { LogBuilder } from "@internal/logger/service/LogBuilder";
import type { LoggerService } from "@internal/logger/service/LoggerService";
import { SdkError } from "@root/src/api/Error";

import type { FramerService } from "./FramerService";

export type DefaultFramerServiceConstructorArgs = {
  frameSize: number;
  channel?: Maybe<Uint8Array>;
  padding?: boolean;
};

@injectable()
export class DefaultFramerService implements FramerService {
  protected _frameSize: number;
  protected _channel: Maybe<Uint8Array>;
  protected _padding: boolean;
  private _logger: LoggerService;

  constructor(
    {
      frameSize,
      channel = Maybe.zero(),
      padding = false,
    }: DefaultFramerServiceConstructorArgs,
    @inject(loggerTypes.LoggerService) logger: LoggerService,
  ) {
    this._frameSize = frameSize;
    this._channel = channel;
    this._padding = padding;
    this._logger = logger;
  }

  /**
   * Get frames from apdu
   *
   * @param apdu
   */
  public getFrames(apdu: Uint8Array): Frame[] {
    const frames: Frame[] = [];
    let count = 0;
    let frame = this.getFrameAtIndex(apdu, count);

    while (frame.isRight()) {
      frames.push(frame.extract());
      count += 1;
      frame = this.getFrameAtIndex(apdu, count).mapLeft((error) => {
        if (error instanceof FramerOverflowError) {
          this._logger.debug(
            LogBuilder.build({ type: "framer" }, { count }, `Frames parsed.`),
          );
        } else {
          this._logger.error(LogBuilder.buildFromError(error));
        }
        return error;
      });
    }
    return frames;
  }

  /**
   * Get apdu frame at index
   * Split every {{PACKET_SIZE - HEADER_SIZE}} bytes of apdu
   * @param apdu
   * @param frameIndex
   * @private
   */
  private getFrameAtIndex(
    apdu: Uint8Array,
    frameIndex: number,
  ): Either<SdkError, Frame> {
    const header = this.getFrameHeaderFrom(frameIndex, apdu.length);
    const frameOffset =
      frameIndex * this._frameSize - this.getHeaderSizeSumFrom(frameIndex);

    if (frameOffset > apdu.length) {
      return Left(new FramerOverflowError());
    }
    if (header.getLength() > this._frameSize) {
      return Left(new FramerApduError());
    }
    const dataMaxSize = this._frameSize - header.getLength();
    const data = apdu.slice(
      frameIndex === 0 ? 0 : frameOffset,
      frameIndex === 0
        ? dataMaxSize
        : frameOffset + this._frameSize - header.getLength(),
    );
    const frameData = this._padding
      ? new Uint8Array(dataMaxSize).fill(0)
      : new Uint8Array(data.length < dataMaxSize ? data.length : dataMaxSize);
    frameData.set(data, 0);
    const frame = new Frame({
      header,
      data: frameData,
    });
    return Right(frame);
  }

  /**
   * Get frame header
   * @param frameIndex
   * @param apduSize
   * @private
   */
  private getFrameHeaderFrom(
    frameIndex: number,
    apduSize: number,
  ): FrameHeader {
    const header = new FrameHeader({
      uuid: v4(),
      channel: this._channel.map((channel) =>
        FramerUtils.getLastBytesFrom(channel, CHANNEL_SIZE),
      ),
      headTag: new Uint8Array([HEAD_TAG]),
      index: new Uint8Array([Math.floor(frameIndex / 0xff), frameIndex & 0xff]),
      length: this.getFrameHeaderSizeFromIndex(frameIndex),
      dataSize: Maybe.zero(),
    });
    if (frameIndex === 0) {
      header.setDataSize(
        Maybe.of(
          new Uint8Array([Math.floor(apduSize / 0xff), apduSize & 0xff]),
        ),
      );
    }
    return header;
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
   * Get frame header size
   * @private
   * @param frameIndex
   */
  private getFrameHeaderSizeFromIndex(frameIndex: number): number {
    return (
      this._channel.caseOf({
        Just: () => CHANNEL_SIZE,
        Nothing: () => 0,
      }) +
      INDEX_SIZE +
      HEAD_TAG_SIZE +
      (frameIndex === 0 ? APDU_DATA_SIZE : 0)
    );
  }
}