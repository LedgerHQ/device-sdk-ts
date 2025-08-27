// WebBleApduSender.ts
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
  private static readonly MTU_OP = 0x08; // same opcode; adjust if your proto differs

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

  private _looksDisconnected(e: unknown): boolean {
    const err = e as any;
    const name = (err?.name ?? "").toString();
    const msg = (err?.message ?? "").toString().toLowerCase();
    return (
      name === "NetworkError" ||
      msg.includes("gatt server is disconnected") ||
      msg.includes("not connected") ||
      msg.includes("cannot perform gatt operations")
    );
  }

  private _gattConnected(): boolean {
    try {
      return !!this._characteristics.notifyCharacteristic.service.device.gatt
        ?.connected;
    } catch {
      return false;
    }
  }

  private _markLinkDown(): void {
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

  private _onReceiveSetup(mtuResponseBuffer: Uint8Array) {
    // example: [0x08,0,0,0,0,<mtu>] where <mtu> is 1 byte in this proto
    const negotiatedMtu = mtuResponseBuffer[5];
    if (
      negotiatedMtu === undefined ||
      !Number.isFinite(negotiatedMtu) ||
      negotiatedMtu <= 0
    ) {
      throw new Error("MTU negotiation failed: invalid MTU");
    }
    this._apduSender = Maybe.of(
      this._apduSenderFactory({ frameSize: negotiatedMtu }),
    );
    this._isDeviceReady.next(true);
  }

  private _onReceiveApdu = (incomingFrame: Uint8Array) => {
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
  };

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

  private async _write(buf: ArrayBuffer) {
    const ch = this._characteristics.writeCharacteristic;

    if (!this._gattConnected()) {
      this._markLinkDown();
      throw new DeviceDisconnectedWhileSendingError("GATT not connected");
    }

    // Robust write-path:
    // 1) Prefer WITH response if supported (most reliable)
    // 2) Fall back to legacy writeValue (treated like with-response in many stacks)
    // 3) Finally WITHOUT response if exposed and allowed
    const hasWithResp =
      typeof (ch as any).writeValueWithResponse === "function";
    const hasWithout =
      typeof (ch as any).writeValueWithoutResponse === "function";
    const hasLegacy = typeof (ch as any).writeValue === "function";

    try {
      if (ch.properties.write && hasWithResp) {
        await (ch as any).writeValueWithResponse(buf);
        return;
      }
      if (hasLegacy && ch.properties.write && !hasWithResp) {
        await (ch as any).writeValue(buf);
        return;
      }
    } catch (e1) {
      if (this._looksDisconnected(e1) || !this._gattConnected()) {
        this._markLinkDown();
        throw new DeviceDisconnectedWhileSendingError(
          "Write failed (with response)",
        );
      }
      // try without-response next
    }

    try {
      if (ch.properties.writeWithoutResponse && hasWithout) {
        await (ch as any).writeValueWithoutResponse(buf);
        return;
      }
      if (hasLegacy) {
        await (ch as any).writeValue(buf);
        return;
      }
      throw new Error("No supported write method for characteristic");
    } catch (e2) {
      if (this._looksDisconnected(e2) || !this._gattConnected()) {
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

  // Wait until notifications are active and MTU negotiated (or timeout)
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

      // fast path in case it flipped
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

  // --- public API (same surface) ---

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

    // small stabilization window
    await this._sleep(150);

    // MTU handshake
    this._mtuHandshakeInFlight = true;
    const mtuReq = new Uint8Array([WebBleApduSender.MTU_OP, 0, 0, 0, 0]);

    try {
      await this._write(mtuReq.buffer);

      // wait until _isDeviceReady flips true via _onReceiveSetup
      await Promise.race([
        new Promise<void>((res) => {
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

  public async sendApdu(
    apdu: Uint8Array,
    _triggersDisconnection?: boolean,
    abortTimeout?: number,
  ): Promise<Either<DmkError, ApduResponse>> {
    try {
      const waitBudget = Math.max(1500, abortTimeout ?? 0);
      await this._awaitReady(waitBudget);
    } catch (e) {
      return Left(e as DmkError);
    }

    // Give the stack a tiny breath before the legacy ping (first APDU after reconnect)
    if (this._isLegacyPing(apdu)) {
      await this._sleep(200);
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
        const msg = _triggersDisconnection
          ? "Frame write failed during expected drop"
          : "Frame write failed";
        this._logger[_triggersDisconnection ? "debug" : "error"](msg, {
          data: { e },
        });
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

    // Best-effort: do not stop notifications here (old link)
    try {
      oldNotify.removeEventListener(
        "characteristicvaluechanged",
        this._handleNotify,
      );
    } catch {
      /* ignore */
    }

    // Mark link as not ready; setupConnection() will re-arm
    this._notificationsActive = false;
    this._isDeviceReady.next(false);
    this._apduSender = Maybe.empty();
    this._sendResolver = Maybe.empty();

    // Swap characteristics & reset deframer
    this._characteristics = deps;
    this._apduReceiver = this._apduReceiverFactory();
    // NOTE: setupConnection() is intentionally not called here;
    // the SM will call it after setDependencies() during reconnect.
  }
}
