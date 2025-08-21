import {
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderServiceFactory,
  type DeviceApduSender,
  DeviceDisconnectedWhileSendingError,
  type DmkError,
  type LoggerPublisherService,
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
  private _apduReceiverFactory: ApduReceiverServiceFactory;
  private _mtuHandshakeInFlight = false;
  private static readonly MTU_OP = 0x08; // adjust to your proto

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
    this._apduReceiverFactory = deps.apduReceiverFactory;
    this._apduReceiver = deps.apduReceiverFactory();
    this._logger = loggerFactory("WebBleApduSender");
  }

  private _failPendingSend(err: DmkError) {
    this._sendResolver.map((r) => r(Left(err)));
    this._sendResolver = Maybe.empty();
  }

  private _handleNotify = (event: Event) => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (!characteristic.value) return;
    const data = new Uint8Array(characteristic.value.buffer);

    if (!this._isDeviceReady.value) {
      if (!this._mtuHandshakeInFlight) {
        this._logger.debug("Dropping pre-handshake frame", { data: { data } });
        return;
      }
      if (data.length < 6 || data[0] !== WebBleApduSender.MTU_OP) {
        this._logger.debug("Non-MTU frame during handshake; dropping", {
          data: { data },
        });
        return;
      }
      this._onReceiveSetup(data);
    } else {
      this._onReceiveApdu(data);
    }
  };

  private _looksDisconnected(e: unknown): boolean {
    const err = e as any;
    const name = (err?.name ?? "").toString();
    const msg = (err?.message ?? "").toString().toLowerCase();
    // Covers Chrome/WebBT errors on Win/macOS/Android
    return (
      name === "NetworkError" ||
      msg.includes("gatt server is disconnected") ||
      msg.includes("not connected") ||
      msg.includes("cannot perform gatt operations")
    );
  }

  private _markLinkDown(): void {
    // Stop delivering frames & force upper layers to treat link as down
    try {
      if (this._notificationsActive) {
        this._characteristics.notifyCharacteristic.removeEventListener(
          "characteristicvaluechanged",
          this._handleNotify,
        );
        this._characteristics.notifyCharacteristic
          .stopNotifications()
          .catch(() => {});
        this._notificationsActive = false;
      }
    } catch {
      /* ignore */
    }

    this._isDeviceReady.next(false);
    this._apduSender = Maybe.empty();
    this._sendResolver = Maybe.empty();
  }

  private _gattConnected(): boolean {
    try {
      return !!this._characteristics.notifyCharacteristic.service.device.gatt
        ?.connected;
    } catch {
      return false;
    }
  }

  private _onReceiveSetup(mtuResponseBuffer: Uint8Array) {
    const negotiatedMtu = mtuResponseBuffer[5]; // adjust if MTU is 16-bit in your proto
    if (typeof negotiatedMtu !== "number" || negotiatedMtu <= 0) {
      throw new Error("MTU negotiation failed: invalid MTU");
    }
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
          this._sendResolver = Maybe.empty();
        }),
      )
      .mapLeft((err) => {
        this._sendResolver.map((r) => r(Left(err)));
        this._sendResolver = Maybe.empty();
      });
  }

  private async _write(buf: ArrayBuffer) {
    const c = this._characteristics.writeCharacteristic;

    // If GATT is down, don't even try
    if (!this._gattConnected()) {
      this._markLinkDown();
      throw new DeviceDisconnectedWhileSendingError("GATT not connected");
    }

    // Try WITH response
    try {
      // @ts-ignore web bluetooth has this
      await c.writeValueWithResponse(buf);
      return;
    } catch (e1) {
      if (this._looksDisconnected(e1)) {
        this._markLinkDown();
        throw new DeviceDisconnectedWhileSendingError(
          "Write failed (with response)",
        );
      }
      // fall through to without-response
    }

    // Try WITHOUT response
    try {
      // @ts-ignore
      await c.writeValueWithoutResponse(buf);
    } catch (e2) {
      if (this._looksDisconnected(e2)) {
        this._markLinkDown();
        throw new DeviceDisconnectedWhileSendingError(
          "Write failed (without response)",
        );
      }
      this._logger.error("Write failed (both modes)", { data: { e2 } });
      throw e2;
    }
  }

  private async _sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Wait until notifications are up + MTU negotiated (or timeout)
  private async _awaitReady(maxMs = 1500): Promise<void> {
    if (
      this._notificationsActive &&
      this._isDeviceReady.value &&
      this._gattConnected()
    )
      return;

    return new Promise<void>((resolve, reject) => {
      const sub = this._isDeviceReady.subscribe((ready) => {
        if (!ready) return;
        if (this._notificationsActive && this._gattConnected()) {
          clearTimeout(t);
          sub.unsubscribe();
          resolve();
        }
      });

      const t = setTimeout(() => {
        sub.unsubscribe();
        reject(new DeviceDisconnectedWhileSendingError("Link not ready"));
      }, maxMs);

      // Fast-path if it flipped between checks
      if (
        this._notificationsActive &&
        this._isDeviceReady.value &&
        this._gattConnected()
      ) {
        clearTimeout(t);
        sub.unsubscribe();
        resolve();
      }
    });
  }

  // Identify the SM’s plain ping
  private _isLegacyPing(apdu: Uint8Array): boolean {
    return (
      apdu.length === 5 &&
      apdu[0] === 0xb0 &&
      apdu[1] === 0x01 &&
      apdu[2] === 0x00 &&
      apdu[3] === 0x00 &&
      apdu[4] === 0x00
    );
  }

  // --- keep setupConnection the single place that starts notifications ---
  public async setupConnection(): Promise<void> {
    const notifyChar = this._characteristics.notifyCharacteristic;

    if (!this._notificationsActive) {
      await notifyChar.startNotifications();
      this._notificationsActive = true;
      notifyChar.addEventListener(
        "characteristicvaluechanged",
        this._handleNotify,
      );
    }

    // small stabilization
    await this._sleep(200);

    this._mtuHandshakeInFlight = true;
    const mtuReq = new Uint8Array([WebBleApduSender.MTU_OP, 0, 0, 0, 0]);

    try {
      await this._write(mtuReq.buffer);

      // wait until _isDeviceReady flips true (set in _onReceiveSetup) or timeout
      await Promise.race([
        new Promise<void>((res, _rej) => {
          const sub = this._isDeviceReady.subscribe((ready) => {
            if (ready) {
              sub.unsubscribe();
              res();
            }
          });
        }),
        this._sleep(2000).then(() => {
          throw new Error("MTU negotiation timeout");
        }),
      ]);
    } catch (e) {
      try {
        notifyChar.removeEventListener(
          "characteristicvaluechanged",
          this._handleNotify,
        );
        await notifyChar.stopNotifications().catch(() => {});
      } finally {
        this._notificationsActive = false;
        this._isDeviceReady.next(false);
        this._apduSender = Maybe.empty();
      }
      throw e;
    } finally {
      this._mtuHandshakeInFlight = false;
    }
  }

  // --- gate the first APDU (esp. the ping) in sendApdu ---
  public async sendApdu(
    apdu: Uint8Array,
    _triggersDisconnection?: boolean,
    abortTimeout?: number,
  ): Promise<Either<DmkError, ApduResponse>> {
    // If handshake still in flight or not ready yet, wait a bit instead of failing
    try {
      await this._awaitReady(Math.min(1500, abortTimeout ?? 1500));
    } catch (e) {
      return Left(e as DmkError);
    }

    // If the very first thing SM sends after reconnect is the legacy ping,
    // give notifications stack a tiny extra breather instead of writing immediately.
    if (this._isLegacyPing(apdu)) {
      await this._sleep(200); // small, conservative delay
    }

    if (!this._gattConnected()) {
      this._markLinkDown();
      return Left(
        new DeviceDisconnectedWhileSendingError(
          "GATT not connected",
        ) as unknown as DmkError,
      );
    }
    if (this._apduSender.isNothing()) {
      return Left(
        new DeviceDisconnectedWhileSendingError(
          "Link not ready (no MTU / sender)",
        ) as unknown as DmkError,
      );
    }

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
        this._failPendingSend(
          new DeviceDisconnectedWhileSendingError("Write failed"),
        );
        break;
      }
    }

    return promise;
  }

  public closeConnection(): void {
    try {
      this._failPendingSend(
        new DeviceDisconnectedWhileSendingError("Connection closed"),
      );

      if (this._notificationsActive) {
        this._characteristics.notifyCharacteristic.removeEventListener(
          "characteristicvaluechanged",
          this._handleNotify,
        );
        this._characteristics.notifyCharacteristic
          .stopNotifications()
          .catch(() => {});
        this._notificationsActive = false;
      }
      this._characteristics.notifyCharacteristic.service.device.gatt?.disconnect();
    } catch {
      this._logger.error("Failed to disconnect from device");
    }
  }

  public getDependencies(): WebBleApduSenderDependencies {
    return this._characteristics;
  }

  public setDependencies(deps: WebBleApduSenderDependencies): void {
    const oldNotify = this._characteristics.notifyCharacteristic;

    // Fail any in-flight APDU before swapping the link
    this._failPendingSend(
      new DeviceDisconnectedWhileSendingError("Link changed"),
    );

    // Best-effort: do NOT await, do NOT stop notifications here
    try {
      oldNotify.removeEventListener(
        "characteristicvaluechanged",
        this._handleNotify,
      );
    } catch {} // ignore

    // Mark link as not ready; setupConnection() will re-arm everything
    this._notificationsActive = false;
    this._isDeviceReady.next(false);
    this._apduSender = Maybe.empty();
    this._sendResolver = Maybe.empty();

    // Swap in new characteristics & fresh deframer
    this._characteristics = deps;
    this._apduReceiver = this._apduReceiverFactory();

    // IMPORTANT: no startNotifications here; setupConnection() will do it.
  }
}
