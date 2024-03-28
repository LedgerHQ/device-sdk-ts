import { inject, injectable } from "inversify";
import { Either, Just, Left, Maybe, Nothing, Right } from "purify-ts";
import { v4 } from "uuid";

import { APDU_RESPONSE_STATUS_CODE_SIZE } from "@internal/device-session/data/ApduResponseConst";
import {
  APDU_DATA_SIZE,
  CHANNEL_SIZE,
  HEAD_TAG_SIZE,
  INDEX_SIZE,
} from "@internal/device-session/data/FramerConst";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";
import { ReceiverApduError } from "@internal/device-session/model/Errors";
import { Frame } from "@internal/device-session/model/Frame";
import { FrameHeader } from "@internal/device-session/model/FrameHeader";
import { FramerUtils } from "@internal/device-session/utils/FramerUtils";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { ApduReceiverService } from "./ApduReceiverService";

type DefaultReceiverConstructorArgs = {
  channel?: Maybe<Uint8Array>;
};

@injectable()
export class DefaultApduReceiverService implements ApduReceiverService {
  private _channel: Maybe<Uint8Array>;
  private _logger: LoggerPublisherService;
  private _pendingFrames: Frame[];

  constructor(
    { channel = Maybe.zero() }: DefaultReceiverConstructorArgs,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._channel = channel;
    this._logger = loggerModuleFactory("receiver");
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
    apdu: Uint8Array,
  ): Either<ReceiverApduError, Maybe<ApduResponse>> {
    const frame = this.apduToFrame(apdu);

    return frame.map((value) => {
      this._logger.debug("handle frame", { data: { frame } });
      this._pendingFrames.push(value);

      const dataSize = this._pendingFrames[0]!.getHeader().getDataSize();
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
        concatenatedFramesData.length - APDU_RESPONSE_STATUS_CODE_SIZE,
      );
      const statusCode = FramerUtils.getLastBytesFrom(
        concatenatedFramesData,
        APDU_RESPONSE_STATUS_CODE_SIZE,
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

  private apduToFrame(apdu: Uint8Array): Either<ReceiverApduError, Frame> {
    const channelSize = this._channel.caseOf({
      Just: () => CHANNEL_SIZE,
      Nothing: () => 0,
    });

    const headTag = apdu.slice(channelSize, channelSize + HEAD_TAG_SIZE);
    const index = apdu.slice(
      channelSize + HEAD_TAG_SIZE,
      channelSize + HEAD_TAG_SIZE + INDEX_SIZE,
    );

    const isFirstIndex = index.reduce((curr, val) => curr + val, 0) === 0;

    if (!isFirstIndex && this._pendingFrames.length === 0) {
      return Left(new ReceiverApduError());
    }

    const dataSizeIndex = channelSize + HEAD_TAG_SIZE + INDEX_SIZE;
    const dataSizeLength = isFirstIndex ? APDU_DATA_SIZE : 0;

    if (
      apdu.length <
      channelSize + HEAD_TAG_SIZE + INDEX_SIZE + dataSizeLength
    ) {
      return Left(new ReceiverApduError("Unable to parse header from apdu"));
    }

    const dataSize = isFirstIndex
      ? Just(apdu.slice(dataSizeIndex, dataSizeIndex + dataSizeLength))
      : Nothing;

    const dataIndex = dataSizeIndex + dataSizeLength;
    const data = apdu.slice(dataIndex);

    const frame = new Frame({
      header: new FrameHeader({
        uuid: v4(),
        channel: this._channel,
        dataSize,
        headTag,
        index,
        length: channelSize + HEAD_TAG_SIZE + INDEX_SIZE + dataSizeLength,
      }),
      data,
    });

    return Right(frame);
  }

  private isComplete(dataSize: number): boolean {
    const totalReceiveLength = this._pendingFrames.reduce(
      (prev: number, curr: Frame) => prev + curr.getData().length,
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
