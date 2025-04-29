import {
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderService,
  type ApduSenderServiceFactory,
  CommandUtils,
  type DeviceConnection,
  DeviceNotInitializedError,
  type DmkError,
  type LoggerPublisherService,
  ReconnectionFailedError,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";

import { ApduExchange } from "./ApduExchange";
import { CharacteristicIO } from "./CharacteristicIO";
import { MtuNegotiator } from "./MtuNegotiator";
import { ReconnectionGate } from "./ReconnectionGate";

export type DataViewEvent = Event & { target: { value: DataView } };

export class BleDeviceConnection implements DeviceConnection {
  private readonly io: CharacteristicIO;
  private readonly mtu: MtuNegotiator;
  private readonly ex: ApduExchange;
  private readonly gate = new ReconnectionGate();
  private _sender: Maybe<ApduSenderService> = Nothing;
  private readonly log: LoggerPublisherService;

  private readonly _serviceUuid: string;
  private readonly _writeCmdUuid: string;
  private readonly _notifyUuid: string;
  private readonly apduSenderFactory: ApduSenderServiceFactory;

  constructor(
    {
      writeCharacteristic,
      notifyCharacteristic,
      apduSenderFactory,
      apduReceiverFactory,
    }: {
      writeCharacteristic: BluetoothRemoteGATTCharacteristic;
      notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
      apduSenderFactory: ApduSenderServiceFactory;
      apduReceiverFactory: ApduReceiverServiceFactory;
    },
    makeLogger: (t: string) => LoggerPublisherService,
  ) {
    this.log = makeLogger("BleDeviceConnection");
    this.apduSenderFactory = apduSenderFactory;
    this.io = new CharacteristicIO(writeCharacteristic, notifyCharacteristic);

    this.mtu = new MtuNegotiator(
      this.io,
      (s) => (this._sender = Maybe.of(apduSenderFactory({ frameSize: s }))),
      this.log,
      () => this.gate.resolve(),
    );
    this.ex = new ApduExchange(
      () => this._sender,
      apduReceiverFactory(),
      this.io,
      this.log,
      () => this._sender.isJust(),
    );

    this._serviceUuid = notifyCharacteristic.service.uuid;
    this._writeCmdUuid = writeCharacteristic.uuid;
    this._notifyUuid = notifyCharacteristic.uuid;
  }

  async setup() {
    const dev = this.io.notify.service.device;
    const gatt = dev.gatt;

    if (!gatt) {
      throw new ReconnectionFailedError("Device has no GATT");
    }

    if (!gatt.connected) {
      await gatt.connect();
    }

    // 👇 Await MTU negotiation fully
    try {
      await this.mtu.negotiate();
    } catch (e) {
      this.log.error("MTU negotiation failed", { data: { e } });
      throw e;
    }
  }

  async sendApdu(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
  ): Promise<Either<DmkError, ApduResponse>> {
    const MAX = 2;
    let last: Either<DmkError, ApduResponse> = Left(
      new UnknownDeviceExchangeError("init"),
    );
    let reran = false;

    for (let i = 1; i <= MAX; i++) {
      last = await this._sendOnce(apdu, triggersDisconnection);
      if (last.isRight()) break;
      const err = last.extract();
      if (err instanceof UnknownDeviceExchangeError && i < MAX) {
        await new Promise((r) => setTimeout(r, 100 * i));
        continue;
      }
      if (err instanceof DeviceNotInitializedError && !reran) {
        await this.setup();
        await new Promise((r) => setTimeout(r, 50));
        reran = true;
        continue;
      }
      break;
    }
    return last;
  }

  async reconnect() {
    this._sender = Nothing;
    this.ex.detach();

    const dev = this.io.notify.service.device;
    if (!dev.gatt?.connected) {
      await dev.gatt!.connect();
    }

    const svc = await dev.gatt!.getPrimaryService(this._serviceUuid);
    const wChr = await svc.getCharacteristic(this._writeCmdUuid);
    const nChr = await svc.getCharacteristic(this._notifyUuid);

    this.io.write = wChr;
    this.io.notify = nChr;

    this.ex.attach();
    await this.io.startNotifications();
    await this.setup();
    // give the BLE stack a lil moment to think
    await new Promise((r) => setTimeout(r, 1000));
  }

  disconnect() {
    this.gate.reject(new ReconnectionFailedError());
  }

  private async _sendOnce(
    apdu: Uint8Array,
    reboot?: boolean,
  ): Promise<Either<DmkError, ApduResponse>> {
    const dev = this.io.notify.service.device;
    if (!dev.gatt?.connected) return Left(new ReconnectionFailedError());
    if (!this.mtu.readyState() && this._sender.isNothing())
      return Left(new DeviceNotInitializedError("Unknown MTU"));

    let recon: Promise<Either<DmkError, void>> | null = null;
    if (reboot) recon = this.gate.wait();

    const res = await this.ex.send(apdu);
    return res.caseOf({
      Right: async (resp) => {
        if (reboot && CommandUtils.isSuccessResponse(resp)) await recon!;
        return Right(resp);
      },
      Left: async (err) => Left(err),
    });
  }

  public onNotifyCharacteristicValueChanged(e: DataViewEvent): void {
    this.ex.onIncoming(e);
    const buf = e.target.value;
    if (buf && buf.byteLength === 6) {
      const arr = new Uint8Array(buf.buffer);
      const size = arr[5];
      if (size) {
        this._sender = Maybe.of(this.apduSenderFactory({ frameSize: size }));
      }
    }
  }
}
