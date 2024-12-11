import { inject, injectable } from "inversify";
import { Either, Just, Left, Maybe, Nothing, Right } from "purify-ts";
import { v4 } from "uuid";

import { ApduResponse } from "@api/device-session/ApduResponse";
import {
  APDU_DATA_LENGTH_LENGTH,
  CHANNEL_LENGTH,
  HEAD_TAG_LENGTH,
  INDEX_LENGTH,
} from "@api/device-session/data/FramerConst";
import {
  type ApduReceiverConstructorArgs,
  ApduReceiverService,
} from "@api/device-session/service/ApduReceiverService";
import { FramerUtils } from "@api/device-session/utils/FramerUtils";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { APDU_RESPONSE_STATUS_CODE_LENGTH } from "@internal/device-session/data/ApduResponseConst";
import { ReceiverApduError } from "@internal/device-session/model/Errors";
import { Frame } from "@internal/device-session/model/Frame";
import { FrameHeader } from "@internal/device-session/model/FrameHeader";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

@injectable()
export class DefaultApduReceiverService implements ApduReceiverService {
  private readonly _channel: Maybe<Uint8Array>;
  private readonly _logger: LoggerPublisherService;
  private _pendingFrames: Frame[];

  constructor(
    { channel = Maybe.zero() }: ApduReceiverConstructorArgs,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._channel = channel;
    this._logger = loggerModuleFactory("ApduReceiverService");
    this._pendingFrames = [];
  }

  /*
   * Return
   * - A complete ApduResponse
   * - Or a Nothing if not all the data has been received
   * - Or a ReceiverApduError if the apdu is not formatted correctly
   *
   * @param Uint8Array
   */
  public handleFrame(
    frameBytes: Uint8Array,
  ): Either<ReceiverApduError, Maybe<ApduResponse>> {
    const frame = this.getFrameFromBytes(frameBytes);

    return frame.map((value) => {
      this._logger.debug("handle frame", {
        data: { frame: value.getRawData() },
      });
      this._pendingFrames.push(value);
      if (!this._pendingFrames[0]) {
        return Nothing;
      }
      const dataSize = this._pendingFrames[0].getHeader().getDataLength();
      return this.getCompleteFrame(dataSize);
    });
  }

  /*
   * Return
   * - A complete ApduResponse
   * - Or a Nothing if not all the data has been received
   *
   * @param Maybe<number>
   */
  private getCompleteFrame(dataSize: Maybe<number>): Maybe<ApduResponse> {
    return dataSize.chain((value) => {
      if (!this.isComplete(value)) {
        this._logger.debug("frame is not complete, waiting for more");
        return Nothing;
      }

      const concatenatedFramesData = FramerUtils.getFirstBytesFrom(
        this.concatFrames(this._pendingFrames),
        value,
      );
      const data = FramerUtils.getFirstBytesFrom(
        concatenatedFramesData,
        concatenatedFramesData.length - APDU_RESPONSE_STATUS_CODE_LENGTH,
      );
      const statusCode = FramerUtils.getLastBytesFrom(
        concatenatedFramesData,
        APDU_RESPONSE_STATUS_CODE_LENGTH,
      );

      this._pendingFrames = [];

      return Just(
        new ApduResponse({
          data: data,
          statusCode,
        }),
      );
    });
  }

  /*
   * Parse an Uint8Array to a Frame
   * Return an error if the frame is not formatted correctly
   *
   * @param Uint8Array
   */
  private getFrameFromBytes(
    rawFrame: Uint8Array,
  ): Either<ReceiverApduError, Frame> {
    const channelSize = this._channel.caseOf({
      Just: () => CHANNEL_LENGTH,
      Nothing: () => 0,
    });

    const headTag = rawFrame.slice(channelSize, channelSize + HEAD_TAG_LENGTH);
    const index = rawFrame.slice(
      channelSize + HEAD_TAG_LENGTH,
      channelSize + HEAD_TAG_LENGTH + INDEX_LENGTH,
    );

    const isFirstIndex = index.reduce((curr, val) => curr + val, 0) === 0;

    if (!isFirstIndex && this._pendingFrames.length === 0) {
      return Left(new ReceiverApduError());
    }

    const dataSizeIndex = channelSize + HEAD_TAG_LENGTH + INDEX_LENGTH;
    const dataSizeLength = isFirstIndex ? APDU_DATA_LENGTH_LENGTH : 0;

    if (
      rawFrame.length <
      channelSize + HEAD_TAG_LENGTH + INDEX_LENGTH + dataSizeLength
    ) {
      return Left(new ReceiverApduError("Unable to parse header from apdu"));
    }

    const dataSize = isFirstIndex
      ? Just(rawFrame.slice(dataSizeIndex, dataSizeIndex + dataSizeLength))
      : Nothing;

    const dataIndex = dataSizeIndex + dataSizeLength;
    const data = rawFrame.slice(dataIndex);

    const frame = new Frame({
      header: new FrameHeader({
        uuid: v4(),
        channel: this._channel,
        dataSize,
        headTag,
        index,
        length: channelSize + HEAD_TAG_LENGTH + INDEX_LENGTH + dataSizeLength,
      }),
      data,
    });

    return Right(frame);
  }

  /*
   * Return true if all the datas has been received
   *
   * @param number
   */
  private isComplete(dataSize: number): boolean {
    const totalReceiveLength = this._pendingFrames.reduce(
      (prev, curr) => prev + curr.getData().length,
      0,
    );

    return totalReceiveLength >= dataSize;
  }

  private concatFrames(frames: Frame[]): Uint8Array {
    return frames.reduce(
      (prev: Uint8Array, curr: Frame) =>
        Uint8Array.from([...prev, ...curr.getData()]),
      new Uint8Array(0),
    );
  }
}
