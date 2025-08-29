/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderServiceFactory,
  type DeviceApduSender,
  DeviceDisconnectedWhileSendingError,
  DeviceNotInitializedError,
  type DmkError,
  type LoggerPublisherService,
  SendApduTimeoutError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Maybe, Right } from "purify-ts";
import { BehaviorSubject } from "rxjs";

export type WebBleApduSenderDependencies = {
  writeCharacteristic: BluetoothRemoteGATTCharacteristic;
  notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
};

const MTU_OP = 0x08;

type WriteMode = "withoutResponse" | "withResponse" | "legacy";

export class WebBleApduSender
  implements DeviceApduSender<WebBleApduSenderDependencies>
{
  private _deps: WebBleApduSenderDependencies;
  private _apduSender: Maybe<ReturnType<ApduSenderServiceFactory>> =
    Maybe.empty();
  private _apduSenderFactory: ApduSenderServiceFactory;
  private _apduReceiverFactory: ApduReceiverServiceFactory;
  private _apduReceiver: ReturnType<ApduReceiverServiceFactory>;
  private _logger: LoggerPublisherService;

  private _isDeviceReady = new BehaviorSubject<boolean>(false);
  private _notificationsActive = false;
  private _mtuHandshakeInFlight = false;

  private _sendResolver: Maybe<(r: Either<DmkError, ApduResponse>) => void> =
    Maybe.empty();

  private _writeMode: WriteMode | null = null;

  constructor(
    deps: WebBleApduSenderDependencies & {
      apduSenderFactory: ApduSenderServiceFactory;
      apduReceiverFactory: ApduReceiverServiceFactory;
    },
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._deps = {
      writeCharacteristic: deps.writeCharacteristic,
      notifyCharacteristic: deps.notifyCharacteristic,
    };
    this._apduSenderFactory = deps.apduSenderFactory;
    this._apduReceiverFactory = deps.apduReceiverFactory;
    this._apduReceiver = deps.apduReceiverFactory();
    this._logger = loggerFactory("WebBleApduSender");
  }

  private _gattConnected(): boolean {
    try {
      return !!this._deps.notifyCharacteristic.service.device.gatt?.connected;
    } catch {
      return false;
    }
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

  private _failPendingSend(err: DmkError) {
    this._sendResolver.map((r) => r(Left(err)));
    this._sendResolver = Maybe.empty();
  }

  private _markLinkDown(): void {
    try {
      if (this._notificationsActive) {
        this._deps.notifyCharacteristic.removeEventListener(
          "characteristicvaluechanged",
          this._handleNotify,
        );
        this._deps.notifyCharacteristic.stopNotifications().catch(() => {});
        this._notificationsActive = false;
      }
    } catch {
      //fill
    }
    this._isDeviceReady.next(false);
    this._apduSender = Maybe.empty();
    this._sendResolver = Maybe.empty();
    this._writeMode = null;
  }

  private async _sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
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
      if (data.length < 6 || data[0] !== MTU_OP) {
        this._logger.debug("Non-MTU frame during handshake; dropping", {
          data: { data },
        });
        return;
      }
      this._onReceiveSetup(data);
      return;
    }

    this._onReceiveApdu(data);
  };

  private _onReceiveSetup(mtuResponseBuffer: Uint8Array) {
    const ledgerMtu = mtuResponseBuffer[5];
    if (
      ledgerMtu === undefined ||
      !Number.isFinite(ledgerMtu) ||
      ledgerMtu <= 0
    ) {
      throw new Error("MTU negotiation failed: invalid MTU");
    }

    const frameSize = Math.max(ledgerMtu - 0, ledgerMtu);
    this._apduSender = Maybe.of(this._apduSenderFactory({ frameSize }));
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

  private _chooseWriteMode(): WriteMode {
    if (this._writeMode) return this._writeMode;
    const ch = this._deps.writeCharacteristic;

    if (ch.properties.writeWithoutResponse) {
      this._writeMode = "withoutResponse";
    } else if (ch.properties.write) {
      this._writeMode = "withResponse";
    } else {
      this._writeMode = "legacy";
    }
    return this._writeMode;
  }

  private async _write(buf: ArrayBuffer) {
    const ch = this._deps.writeCharacteristic;

    if (!this._gattConnected()) {
      this._markLinkDown();
      throw new DeviceDisconnectedWhileSendingError("GATT not connected");
    }

    const hasWithResp =
      typeof (ch as any).writeValueWithResponse === "function";
    const hasWithout =
      typeof (ch as any).writeValueWithoutResponse === "function";
    const hasLegacy = typeof (ch as any).writeValue === "function";

    const tryWithout = async () => {
      if (ch.properties.writeWithoutResponse && hasWithout) {
        await (ch as any).writeValueWithoutResponse(buf);
        this._writeMode = "withoutResponse";
        return true;
      }
      return false;
    };

    const tryWith = async () => {
      if (ch.properties.write && hasWithResp) {
        await (ch as any).writeValueWithResponse(buf);
        this._writeMode = "withResponse";
        return true;
      }
      if (ch.properties.write && hasLegacy) {
        await (ch as any).writeValue(buf);
        this._writeMode = "legacy";
        return true;
      }
      return false;
    };

    const preferred = this._chooseWriteMode();

    try {
      if (preferred === "withoutResponse") {
        if (await tryWithout()) return;
        if (await tryWith()) return;
      } else {
        if (await tryWith()) return;
        if (await tryWithout()) return;
      }
      throw new Error("No supported write method for characteristic");
    } catch (e) {
      if (this._looksDisconnected(e) || !this._gattConnected()) {
        this._markLinkDown();
        throw new DeviceDisconnectedWhileSendingError("Write failed");
      }

      throw e;
    }
  }

  private async _awaitReady(maxMs = 2000): Promise<void> {
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
        reject(new DeviceNotInitializedError("Link not ready"));
      }, maxMs);

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

  public async setupConnection(): Promise<void> {
    const notifyChar = this._deps.notifyCharacteristic;
    if (!this._notificationsActive) {
      await notifyChar.startNotifications();
      this._logger.debug("Notify armed", {
        data: {
          notifyUuid: this._deps.notifyCharacteristic.uuid,
          writeUuid: this._deps.writeCharacteristic.uuid,
          props: this._deps.writeCharacteristic.properties,
        },
      });
      this._notificationsActive = true;
      notifyChar.addEventListener(
        "characteristicvaluechanged",
        this._handleNotify,
      );
    }

    await this._sleep(120);

    this._mtuHandshakeInFlight = true;
    this._isDeviceReady.next(false);
    this._apduSender = Maybe.empty();
    this._writeMode = null;

    const mtuReq = new Uint8Array([MTU_OP, 0, 0, 0, 0]);

    try {
      await this._write(mtuReq.buffer);

      await Promise.race([
        new Promise<void>((res, rej) => {
          const t = setTimeout(
            () => rej(new Error("MTU negotiation timeout")),
            2000,
          );
          const sub = this._isDeviceReady.subscribe((ready) => {
            if (ready) {
              clearTimeout(t);
              sub.unsubscribe();
              res();
            }
          });
        }),

        this._sleep(2300).then(() => {
          if (!this._gattConnected()) {
            throw new DeviceDisconnectedWhileSendingError(
              "Link dropped during MTU",
            );
          }
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
        this._writeMode = null;
      }
      throw e;
    } finally {
      this._mtuHandshakeInFlight = false;
    }
  }

  public async sendApdu(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
    abortTimeout?: number,
  ): Promise<Either<DmkError, ApduResponse>> {
    try {
      const waitBudget = Math.max(1800, abortTimeout ?? 0);
      await this._awaitReady(waitBudget);
    } catch (e) {
      return Left(e as DmkError);
    }

    if (this._isLegacyPing(apdu)) {
      await this._sleep(160);
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
        new DeviceNotInitializedError(
          "Unknown MTU / sender not ready",
        ) as unknown as DmkError,
      );
    }

    let to: ReturnType<typeof setTimeout> | undefined;
    const promise = new Promise<Either<DmkError, ApduResponse>>((resolve) => {
      this._sendResolver = Maybe.of((r) => {
        if (to) clearTimeout(to);
        resolve(r);
      });
    });

    const frames = this._apduSender.map((s) => s.getFrames(apdu)).orDefault([]);

    for (const frame of frames) {
      try {
        await this._write(frame.getRawData().slice().buffer);
      } catch (e) {
        const msg = triggersDisconnection
          ? "Frame write failed during expected drop"
          : "Frame write failed";
        this._logger[triggersDisconnection ? "debug" : "error"](msg, {
          data: { e },
        });
        this._failPendingSend(
          new DeviceDisconnectedWhileSendingError("Write failed"),
        );
        break;
      }
    }

    if (abortTimeout) {
      to = setTimeout(() => {
        this._logger.debug("[sendApdu] Abort timeout triggered");
        this._sendResolver.map((resolve) =>
          resolve(Left(new SendApduTimeoutError("Abort timeout"))),
        );
      }, abortTimeout);
    }

    return promise;
  }

  public closeConnection(): void {
    try {
      this._failPendingSend(
        new DeviceDisconnectedWhileSendingError("Connection closed"),
      );
      if (this._notificationsActive) {
        this._deps.notifyCharacteristic.removeEventListener(
          "characteristicvaluechanged",
          this._handleNotify,
        );
        this._deps.notifyCharacteristic.stopNotifications().catch(() => {});
        this._notificationsActive = false;
      }
      this._deps.notifyCharacteristic.service.device.gatt?.disconnect();
    } catch {
      this._logger.error("Failed to disconnect from device");
    } finally {
      this._isDeviceReady.next(false);
      this._apduSender = Maybe.empty();
      this._writeMode = null;
    }
  }

  public getDependencies(): WebBleApduSenderDependencies {
    return this._deps;
  }

  public setDependencies(deps: WebBleApduSenderDependencies): void {
    this._failPendingSend(
      new DeviceDisconnectedWhileSendingError("Link changed"),
    );

    try {
      if (this._notificationsActive) {
        this._deps.notifyCharacteristic.removeEventListener(
          "characteristicvaluechanged",
          this._handleNotify,
        );
        this._deps.notifyCharacteristic.stopNotifications().catch(() => {});
      }
    } catch {
      //fill
    }

    this._notificationsActive = false;
    this._isDeviceReady.next(false);
    this._apduSender = Maybe.empty();
    this._sendResolver = Maybe.empty();
    this._writeMode = null;

    this._deps = deps;
    this._apduReceiver = this._apduReceiverFactory();
  }
}
