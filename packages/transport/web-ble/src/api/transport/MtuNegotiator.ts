import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { isDataViewEvent } from "@api/utils/utils";

import { type CharacteristicIO } from "./CharacteristicIO";

export class MtuNegotiator {
  private ready: Promise<void> = Promise.resolve();
  private resolveReady: () => void = () => {};
  private _ready = false;

  constructor(
    private readonly io: CharacteristicIO,
    private readonly onSenderReady: (size: number) => void,
    private readonly log: LoggerPublisherService,
    private readonly onNegotiated: () => void,
  ) {}

  readyState() {
    return this._ready;
  }

  async negotiate(): Promise<void> {
    this.ready = new Promise<void>((r) => (this.resolveReady = r));
    this._ready = false;

    const onMtu = (e: Event) => {
      if (!isDataViewEvent(e)) return;
      const size = new Uint8Array(e.target.value.buffer)[5];
      if (!size) return;

      this.onSenderReady(size);
      this._ready = true;

      this.io.notify.removeEventListener("characteristicvaluechanged", onMtu);

      this.log.debug(`MTU negotiated: frameSize=${size}`);
      this.resolveReady();
      this.onNegotiated();
    };

    this.io.notify.addEventListener("characteristicvaluechanged", onMtu);

    await this.io.startNotifications();
    await this.io.writeValue(Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]));

    await this.ready;
  }
}
