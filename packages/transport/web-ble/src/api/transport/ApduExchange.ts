import {
  type ApduReceiverService,
  type ApduResponse,
  type ApduSenderService,
  type DmkError,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Maybe, Right } from "purify-ts";

import { isDataViewEvent } from "@api/utils/utils";

import { type CharacteristicIO } from "./CharacteristicIO";

export class ApduExchange {
  private readonly bound: (e: Event) => void;
  private resolver: Maybe<{
    resolve(v: Either<DmkError, ApduResponse>): void;
  }> = Maybe.zero();

  constructor(
    private readonly sender: () => Maybe<ApduSenderService>,
    private readonly receiver: ApduReceiverService,
    private readonly io: CharacteristicIO,
    private readonly log: LoggerPublisherService,
    private readonly isReady: () => boolean,
  ) {
    this.bound = this.onIncoming.bind(this);
    this.io.onValueChanged(this.bound);
  }
  detach() {
    this.io.offValueChanged();
  }
  attach() {
    this.io.onValueChanged(this.bound);
  }

  async send(apdu: Uint8Array): Promise<Either<DmkError, ApduResponse>> {
    const frames = this.sender().mapOrDefault((s) => s.getFrames(apdu), []);
    const p = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => (this.resolver = Maybe.of({ resolve })),
    );

    for (const f of frames) {
      try {
        await this.io.writeValue(f.getRawData());
      } catch (e) {
        this.log.error("write frame", { data: { e } });
      }
    }

    const res = await p;
    this.resolver = Maybe.zero();
    return res;
  }

  public onIncoming(e: Event) {
    if (!this.isReady() || !isDataViewEvent(e) || this.resolver.isNothing())
      return;
    try {
      const parsed = this.receiver.handleFrame(
        new Uint8Array(e.target.value.buffer),
      );
      parsed
        .map((m) =>
          m.ifJust((resp) =>
            this.resolver.ifJust(({ resolve }) => resolve(Right(resp))),
          ),
        )
        .mapLeft((err) =>
          this.resolver.ifJust(({ resolve }) => resolve(Left(err))),
        );
    } catch (err) {
      this.log.error("parse error", { data: { err } });
      this.resolver.ifJust(({ resolve }) => resolve(Left(err as DmkError)));
    }
  }
}
