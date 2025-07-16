import {
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderServiceFactory,
  type DeviceApduSender,
  type DmkError,
  type LoggerPublisherService,
  OpeningConnectionError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Maybe, Right } from "purify-ts";
import { BehaviorSubject } from "rxjs";

export type WebBleApduSenderDependencies = {
  writeCharacteristic: BluetoothRemoteGATTCharacteristic;
  notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
};

export class WebBleApduSender
  implements DeviceApduSender<WebBleApduSenderDependencies>
{
  private _characteristics: WebBleApduSenderDependencies;
  private _apduSender: Maybe<ReturnType<ApduSenderServiceFactory>> =
    Maybe.empty();
  private _apduSenderFactory: ApduSenderServiceFactory;
  private _apduReceiver: ReturnType<ApduReceiverServiceFactory>;
  private _logger: LoggerPublisherService;
  private _isDeviceReady = new BehaviorSubject<boolean>(false);
  private _sendResolver: Maybe<
    (result: Either<DmkError, ApduResponse>) => void
  > = Maybe.empty();
  private _notificationsActive = false;

  constructor(
    deps: WebBleApduSenderDependencies & {
      apduSenderFactory: ApduSenderServiceFactory;
      apduReceiverFactory: ApduReceiverServiceFactory;
    },
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._characteristics = {
      writeCharacteristic: deps.writeCharacteristic,
      notifyCharacteristic: deps.notifyCharacteristic,
    };
    this._apduSenderFactory = deps.apduSenderFactory;
    this._apduReceiver = deps.apduReceiverFactory();
    this._logger = loggerFactory("WebBleApduSender");
  }

  private _handleNotify = (event: Event) => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;

    if (!characteristic.value) return;

    const data = new Uint8Array(characteristic.value.buffer);

    if (!this._isDeviceReady.value) {
      this._onReceiveSetup(data);
    } else {
      this._onReceiveApdu(data);
    }
  };

  private _onReceiveSetup(mtuResponseBuffer: Uint8Array) {
    if (mtuResponseBuffer.length < 6)
      throw new Error(
        "MTU negotiation failed: No valid MTU received from device",
      );

    const negotiatedMtu = mtuResponseBuffer[5];

    if (typeof negotiatedMtu !== "number")
      throw new Error(
        "MTU negotiation failed: No valid MTU received from device",
      );

    this._apduSender = Maybe.of(
      this._apduSenderFactory({ frameSize: negotiatedMtu }),
    );

    this._isDeviceReady.next(true);
  }

  private _onReceiveApdu(incomingFrame: Uint8Array) {
    this._apduReceiver
      .handleFrame(incomingFrame)
      .map((respOpt) =>
        respOpt.map((resp) => {
          this._logger.debug("Received APDU", { data: { resp } });
          this._sendResolver.map((r) => r(Right(resp)));
        }),
      )
      .mapLeft((err) => this._sendResolver.map((r) => r(Left(err))));
  }

  private async _write(buf: ArrayBuffer) {
    try {
      await this._characteristics.writeCharacteristic.writeValueWithResponse(
        buf,
      );
    } catch {
      await this._characteristics.writeCharacteristic.writeValueWithoutResponse(
        buf,
      );
    }
  }

  public async setupConnection(): Promise<void> {
    const notifyChar = this._characteristics.notifyCharacteristic;
    await notifyChar.startNotifications();

    this._notificationsActive = true;

    notifyChar.addEventListener(
      "characteristicvaluechanged",
      this._handleNotify,
    );

    const mtuReq = new Uint8Array([0x08, 0, 0, 0, 0]);
    await this._write(mtuReq.buffer);

    try {
      // await either a good MTU negotiation or timeout
      await Promise.race([
        new Promise<void>((res, rej) => {
          const sub = this._isDeviceReady.subscribe({
            next: (ready) => {
              if (ready) {
                sub.unsubscribe();
                res();
              }
            },
            error: (e) => {
              sub.unsubscribe();
              rej(e);
            },
          });
        }),
        new Promise<void>((_, rej) =>
          setTimeout(() => rej(new Error("MTU negotiation timeout")), 2000),
        ),
      ]);
    } catch (e: unknown) {
      this._logger.error("MTU negotiation failed", { data: { error: e } });

      // clean up listener on failure
      notifyChar.removeEventListener(
        "characteristicvaluechanged",
        this._handleNotify,
      );

      this._notificationsActive = false;
      const errorMessage = e instanceof Error ? e.message : String(e);

      // propagate error so connection setup fails fast
      throw new OpeningConnectionError(
        `MTU negotiation failed: ${errorMessage}`,
      );
    }
  }

  public async sendApdu(
    apdu: Uint8Array,
    _triggersDisconnection?: boolean,
    _abortTimeout?: number,
  ): Promise<Either<DmkError, ApduResponse>> {
    const promise = new Promise<Either<DmkError, ApduResponse>>((resolve) => {
      this._sendResolver = Maybe.of(resolve);
    });

    for (const frame of this._apduSender
      .map((s) => s.getFrames(apdu))
      .orDefault([])) {
      try {
        await this._write(frame.getRawData().buffer);
      } catch (e) {
        this._logger.error("Frame write failed", { data: { e } });
      }
    }

    return promise;
  }

  public closeConnection(): void {
    try {
      this._characteristics.notifyCharacteristic.service.device.gatt?.disconnect();
    } catch {
      this._logger.error("Failed to disconnect from device");
    }
  }

  public getDependencies(): WebBleApduSenderDependencies {
    return this._characteristics;
  }

  public async setDependencies(
    deps: WebBleApduSenderDependencies,
  ): Promise<void> {
    const oldNotify = this._characteristics.notifyCharacteristic;

    if (this._notificationsActive && oldNotify.service.device.gatt?.connected) {
      try {
        await oldNotify.stopNotifications();
      } catch {
        this._logger.debug(
          "stopNotifications() threw, but that's expected if disconnected",
        );
      }
    }

    // remove listener once
    oldNotify.removeEventListener(
      "characteristicvaluechanged",
      this._handleNotify,
    );

    this._notificationsActive = false;

    // swap in new characteristics
    this._characteristics = deps;
    this._isDeviceReady.next(false);
    this._apduSender = Maybe.empty();
    this._sendResolver = Maybe.empty();

    // bind new notify characteristic
    await deps.notifyCharacteristic.startNotifications();
    this._notificationsActive = true;
    deps.notifyCharacteristic.addEventListener(
      "characteristicvaluechanged",
      this._handleNotify,
    );
  }
}
