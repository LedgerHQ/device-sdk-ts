import { Either, Left, Maybe, Right } from "purify-ts";
import { v4 } from "uuid";

import {
  APDU_DATA_LENGTH_LENGTH,
  CHANNEL_LENGTH,
  HEAD_TAG,
  HEAD_TAG_LENGTH,
  INDEX_LENGTH,
} from "@internal/device-session/data/FramerConst";
import {
  FramerApduError,
  FramerOverflowError,
  FrameSizeUnsetError,
} from "@internal/device-session/model/Errors";
import { Frame } from "@internal/device-session/model/Frame";
import { FrameHeader } from "@internal/device-session/model/FrameHeader";
import { DefaultApduReceiverService } from "@internal/device-session/service/DefaultApduReceiverService";
import { FramerUtils } from "@internal/device-session/utils/FramerUtils";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { SdkError } from "@root/src/api/Error";

import type { ApduSenderService } from "./ApduSenderService";

export type DefaultApduSenderServiceConstructorArgs = {
  loggerFactory: (name: string) => LoggerPublisherService;
  frameSize?: number;
  channel?: Uint8Array;
  padding?: boolean;
};

/**
 * Default implementation of ApduSenderService
 *
 * Split APDU in an array of frames readies to send to a InternalConnectedDevice
 */
export class DefaultApduSenderService implements ApduSenderService {
  protected _frameSize: Maybe<number>;
  protected _channel: Maybe<Uint8Array>;
  protected _padding: boolean;
  private _logger: LoggerPublisherService;

  /**
   * Constructor
   *
   * @param frameSize
   * @param channel
   * @param padding
   * @param loggerServiceFactory
   */
  constructor({
    frameSize,
    loggerFactory,
    channel,
    padding = false,
  }: DefaultApduSenderServiceConstructorArgs) {
    this._frameSize = Maybe.fromNullable(frameSize);
    this._channel = Maybe.fromNullable(channel);
    this._padding = padding;
    this._logger = loggerFactory(DefaultApduReceiverService.name);
  }

  /**
   * Set frame size
   */
  public setFrameSize(frameSize: number) {
    this._frameSize = Maybe.of(frameSize);
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
          this._logger.debug("Frames parsed", { data: { count } });
        } else {
          this._logger.error("Error while parsing frame", { data: { error } });
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
    return this._frameSize
      .toEither(new FrameSizeUnsetError("Missing frame size"))
      .chain((frameSize) => {
        const header = this.getFrameHeaderFrom(frameIndex, apdu.length);
        const frameOffset =
          frameIndex * frameSize - this.getHeaderSizeSumFrom(frameIndex);

        if (frameOffset > apdu.length) {
          return Left(new FramerOverflowError());
        }
        if (header.getLength() > frameSize) {
          return Left(new FramerApduError());
        }
        const dataMaxSize = frameSize - header.getLength();
        const data = apdu.slice(
          frameIndex === 0 ? 0 : frameOffset,
          frameIndex === 0
            ? dataMaxSize
            : frameOffset + frameSize - header.getLength(),
        );
        const frameData = this._padding
          ? new Uint8Array(dataMaxSize).fill(0)
          : new Uint8Array(
              data.length < dataMaxSize ? data.length : dataMaxSize,
            );
        frameData.set(data, 0);
        const frame = new Frame({
          header,
          data: frameData,
        });
        return Right(frame);
      });
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
        FramerUtils.getLastBytesFrom(channel, CHANNEL_LENGTH),
      ),
      headTag: new Uint8Array([HEAD_TAG]),
      index: FramerUtils.numberToByteArray(frameIndex, INDEX_LENGTH),
      length: this.getFrameHeaderSizeFromIndex(frameIndex),
      dataSize: Maybe.zero(),
    });
    if (frameIndex === 0) {
      header.setDataSize(
        Maybe.of(
          FramerUtils.numberToByteArray(apduSize, APDU_DATA_LENGTH_LENGTH),
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
        Just: () => CHANNEL_LENGTH,
        Nothing: () => 0,
      }) +
      INDEX_LENGTH +
      HEAD_TAG_LENGTH +
      (frameIndex === 0 ? APDU_DATA_LENGTH_LENGTH : 0)
    );
  }
}
