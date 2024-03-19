import { inject, injectable } from "inversify";
import { Just, Maybe } from "purify-ts";

import { Frame } from "@internal/device-session/model/Frame";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { ReciverService } from "./ReceiverService";

@injectable()
export class DefaultReceiverService implements ReciverService {
  private _logger: LoggerPublisherService;
  private _pendingFrames: Frame[];

  constructor(
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._logger = loggerModuleFactory("receiver");
    this._pendingFrames = [];
  }

  public getApdu(frame: Frame): Maybe<Uint8Array> {
    this._pendingFrames.push(frame);
    console.log(frame);

    if (this.isComplete(frame)) {
      this._logger.debug("complete");
      return Just(this.concatFrames(this._pendingFrames));
    }

    return Maybe.empty();
  }

  private isComplete(frame: Frame): boolean {
    console.log(frame.getHeader().getLength());
    if (frame.isFirstIndex())
      return frame.getHeader().getLength() === frame.getData().length;

    const totalReceiveLength = this._pendingFrames.reduce(
      (prev: number, curr: Frame) => prev + curr.getData().length,
      0,
    );
    return (
      totalReceiveLength === this._pendingFrames[0]?.getHeader().getLength()
    );
  }

  private concatFrames(frames: Frame[]): Uint8Array {
    return frames.reduce(
      (prev: Uint8Array, curr: Frame) =>
        Uint8Array.from([...prev, ...curr.getRawData()]),
      new Uint8Array(0),
    );
  }
}
