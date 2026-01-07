import {
  type ApduReceiverService,
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderService,
  type ApduSenderServiceFactory,
  type DeviceApduSender,
  DeviceDisconnectedWhileSendingError,
  DeviceNotInitializedError,
  type DmkError,
  formatApduReceivedLog,
  formatApduSentLog,
  type LoggerPublisherService,
  SendApduTimeoutError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Maybe, Right } from "purify-ts";
import { BehaviorSubject } from "rxjs";

export type WebBleApduSenderDependencies = {
  writeCharacteristic: BluetoothRemoteGATTCharacteristic;
  notifyCharacteristic: BluetoothRemoteGATTCharacteristic;
};

export const MTU_OP = 0x08;

export class WebBleApduSender
  implements DeviceApduSender<WebBleApduSenderDependencies>
{
  private _dependencies: WebBleApduSenderDependencies;
  private _apduFrameSegmenter: Maybe<ApduSenderService> = Maybe.empty();
  private _apduSenderFactory: ApduSenderServiceFactory;
  private _apduReceiverFactory: ApduReceiverServiceFactory;
  private _apduFrameReceiver: ApduReceiverService;
  private _logger: LoggerPublisherService;

  private _mtuNegotiated$ = new BehaviorSubject<boolean>(false);
  private _notificationsReady = false;
  private _mtuRequestInProgress = false;

  private _pendingResponseResolver: Maybe<
    (r: Either<DmkError, ApduResponse>) => void
  > = Maybe.empty();

  constructor(
    initialDependencies: WebBleApduSenderDependencies & {
      apduSenderFactory: ApduSenderServiceFactory;
      apduReceiverFactory: ApduReceiverServiceFactory;
    },
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._dependencies = {
      writeCharacteristic: initialDependencies.writeCharacteristic,
      notifyCharacteristic: initialDependencies.notifyCharacteristic,
    };
    this._apduSenderFactory = initialDependencies.apduSenderFactory;
    this._apduReceiverFactory = initialDependencies.apduReceiverFactory;
    this._apduFrameReceiver = initialDependencies.apduReceiverFactory();
    this._logger = loggerFactory("WebBleApduSender");
  }

  public async sendApdu(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
    abortTimeout?: number,
  ): Promise<Either<DmkError, ApduResponse>> {
    try {
      const waitBudget = Math.max(1800, abortTimeout ?? 0);
      await this._waitUntilMtuNegotiated(waitBudget);
    } catch (e) {
      return Left(e as DmkError);
    }

    if (!this._isGattConnected()) {
      this._markLinkUnavailable();
      return Left(
        new DeviceDisconnectedWhileSendingError(
          "GATT not connected",
        ) as unknown as DmkError,
      );
    }

    if (this._apduFrameSegmenter.isNothing()) {
      return Left(
        new DeviceNotInitializedError(
          "Unknown MTU / sender not ready",
        ) as unknown as DmkError,
      );
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const responsePromise = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => {
        this._pendingResponseResolver = Maybe.of((result) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          resolve(result);
        });
      },
    );

    const frames = this._apduFrameSegmenter
      .map((segmenter) => segmenter.getFrames(apdu))
      .orDefault([]);

    for (const frame of frames) {
      try {
        await this._writeToGattCharacteristic(
          frame.getRawData().slice().buffer,
        );
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
    this._logger.debug(formatApduSentLog(apdu));

    if (abortTimeout) {
      timeoutHandle = setTimeout(() => {
        this._logger.debug("[sendApdu] Abort timeout triggered");
        this._pendingResponseResolver.map((resolve) =>
          resolve(Left(new SendApduTimeoutError("Abort timeout"))),
        );
      }, abortTimeout);
    }

    return responsePromise;
  }

  public closeConnection(): void {
    try {
      this._failPendingSend(
        new DeviceDisconnectedWhileSendingError("Connection closed"),
      );
      if (this._notificationsReady) {
        this._dependencies.notifyCharacteristic.removeEventListener(
          "characteristicvaluechanged",
          this._handleNotification,
        );
        this._dependencies.notifyCharacteristic
          .stopNotifications()
          .catch(() => {});
        this._notificationsReady = false;
      }
      this._dependencies.notifyCharacteristic.service.device.gatt?.disconnect();
    } catch {
      this._logger.error("Failed to disconnect from device");
    } finally {
      this._mtuNegotiated$.next(false);
      this._apduFrameSegmenter = Maybe.empty();
    }
  }

  public getDependencies(): WebBleApduSenderDependencies {
    return this._dependencies;
  }

  public setDependencies(deps: WebBleApduSenderDependencies): void {
    this._failPendingSend(
      new DeviceDisconnectedWhileSendingError("Link changed"),
    );

    try {
      if (this._notificationsReady) {
        this._dependencies.notifyCharacteristic.removeEventListener(
          "characteristicvaluechanged",
          this._handleNotification,
        );
        this._dependencies.notifyCharacteristic
          .stopNotifications()
          .catch(() => {});
      }
    } catch {
      // ignore
    }

    this._notificationsReady = false;
    this._mtuNegotiated$.next(false);
    this._apduFrameSegmenter = Maybe.empty();
    this._pendingResponseResolver = Maybe.empty();

    this._dependencies = deps;
    this._apduFrameReceiver = this._apduReceiverFactory();
  }

  public async setupConnection(): Promise<void> {
    const notifyCharacteristic = this._dependencies.notifyCharacteristic;
    if (!this._notificationsReady) {
      await notifyCharacteristic.startNotifications();
      this._logger.debug("Notify armed", {
        data: {
          notifyUuid: this._dependencies.notifyCharacteristic.uuid,
          writeUuid: this._dependencies.writeCharacteristic.uuid,
          props: this._dependencies.writeCharacteristic.properties,
        },
      });
      this._notificationsReady = true;
      notifyCharacteristic.addEventListener(
        "characteristicvaluechanged",
        this._handleNotification,
      );
    }

    // Avoids possible drops on the very first notification if we write immediately
    await this._sleep(120);

    this._mtuRequestInProgress = true;
    this._mtuNegotiated$.next(false);
    this._apduFrameSegmenter = Maybe.empty();

    const mtuRequestFrame = new Uint8Array([MTU_OP, 0, 0, 0, 0]);

    try {
      await this._writeToGattCharacteristic(mtuRequestFrame.buffer);

      await Promise.race([
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("MTU negotiation timeout")),
            2000,
          );
          const sub = this._mtuNegotiated$.subscribe((ready) => {
            if (ready) {
              clearTimeout(timeout);
              sub.unsubscribe();
              resolve();
            }
          });
        }),
        this._sleep(2300).then(() => {
          if (!this._isGattConnected()) {
            throw new DeviceDisconnectedWhileSendingError(
              "Link dropped during MTU",
            );
          }
        }),
      ]);
    } catch (e) {
      try {
        notifyCharacteristic.removeEventListener(
          "characteristicvaluechanged",
          this._handleNotification,
        );
        await notifyCharacteristic.stopNotifications().catch(() => {});
      } finally {
        this._notificationsReady = false;
        this._mtuNegotiated$.next(false);
        this._apduFrameSegmenter = Maybe.empty();
      }
      throw e;
    } finally {
      this._mtuRequestInProgress = false;
    }
  }

  private _isGattConnected(): boolean {
    try {
      return !!this._dependencies.notifyCharacteristic.service.device.gatt
        ?.connected;
    } catch {
      return false;
    }
  }

  private _isGattDisconnectedError(e: unknown): boolean {
    const err = e as Error | { name?: string; message?: string };
    const name = (
      typeof err === "object" && err !== null && "name" in err
        ? (err.name ?? "")
        : ""
    ).toString();
    const msg = (
      typeof err === "object" && err !== null && "message" in err
        ? (err.message ?? "")
        : ""
    )
      .toString()
      .toLowerCase();
    return (
      name === "NetworkError" ||
      msg.includes("gatt server is disconnected") ||
      msg.includes("not connected") ||
      msg.includes("cannot perform gatt operations")
    );
  }

  private _failPendingSend(err: DmkError) {
    this._pendingResponseResolver.map((resolve) => resolve(Left(err)));
    this._pendingResponseResolver = Maybe.empty();
  }

  private _markLinkUnavailable(): void {
    if (this._notificationsReady) {
      this._dependencies.notifyCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        this._handleNotification,
      );
      this._dependencies.notifyCharacteristic
        .stopNotifications()
        .catch(() => {});
      this._notificationsReady = false;
    }

    this._mtuNegotiated$.next(false);
    this._apduFrameSegmenter = Maybe.empty();
    this._pendingResponseResolver = Maybe.empty();
  }

  private async _sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private _handleNotification = (event: Event) => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (!characteristic.value) return;
    const data = new Uint8Array(characteristic.value.buffer);

    if (!this._mtuNegotiated$.value) {
      if (!this._mtuRequestInProgress) {
        this._logger.debug("Dropping pre-handshake frame", { data: { data } });
        return;
      }
      if (data.length < 6 || data[0] !== MTU_OP) {
        this._logger.debug("Non-MTU frame during handshake; dropping", {
          data: { data },
        });
        return;
      }
      this._handleMtuNegotiationFrame(data);
      return;
    }

    this._handleApduFrame(data);
  };

  private _handleMtuNegotiationFrame(mtuResponseBuffer: Uint8Array) {
    const ledgerMtu = mtuResponseBuffer[5];
    if (
      ledgerMtu === undefined ||
      !Number.isFinite(ledgerMtu) ||
      ledgerMtu <= 0
    ) {
      throw new Error("MTU negotiation failed: invalid MTU");
    }

    const frameSize = ledgerMtu;
    this._apduFrameSegmenter = Maybe.of(this._apduSenderFactory({ frameSize }));
    this._mtuNegotiated$.next(true);
  }

  private _handleApduFrame(incomingFrame: Uint8Array) {
    this._apduFrameReceiver
      .handleFrame(incomingFrame)
      .map((maybeResponse) =>
        maybeResponse.map((resp) => {
          this._logger.debug(formatApduReceivedLog(resp));
          this._pendingResponseResolver.map((resolve) => resolve(Right(resp)));
          this._pendingResponseResolver = Maybe.empty();
        }),
      )
      .mapLeft((err) => {
        this._pendingResponseResolver.map((resolve) => resolve(Left(err)));
        this._pendingResponseResolver = Maybe.empty();
      });
  }

  private async _writeToGattCharacteristic(buf: ArrayBuffer) {
    const ch = this._dependencies.writeCharacteristic;

    if (!this._isGattConnected()) {
      this._markLinkUnavailable();
      throw new DeviceDisconnectedWhileSendingError("GATT not connected");
    }

    const hasWnr = typeof ch.writeValueWithoutResponse === "function";
    const hasWr = typeof ch.writeValueWithResponse === "function";

    // Prefer WNR for Ledger throughput
    if (ch.properties.writeWithoutResponse && hasWnr) {
      try {
        await ch.writeValueWithoutResponse(buf);
        return;
      } catch (e) {
        if (this._isGattDisconnectedError(e) || !this._isGattConnected()) {
          this._markLinkUnavailable();
          throw new DeviceDisconnectedWhileSendingError("Write failed");
        }
        // otherwise, try WR
      }
    }

    if (ch.properties.write && hasWr) {
      await ch.writeValueWithResponse(buf);
      return;
    }

    throw new Error("No supported write method for characteristic");
  }

  private async _waitUntilMtuNegotiated(maxMs = 2000): Promise<void> {
    if (
      this._notificationsReady &&
      this._mtuNegotiated$.value &&
      this._isGattConnected()
    )
      return;

    return new Promise<void>((resolve, reject) => {
      const subscription = this._mtuNegotiated$.subscribe((ready) => {
        if (!ready) return;
        if (this._notificationsReady && this._isGattConnected()) {
          clearTimeout(timer);
          subscription.unsubscribe();
          resolve();
        }
      });

      const timer = setTimeout(() => {
        subscription.unsubscribe();
        reject(new DeviceNotInitializedError("Link not ready"));
      }, maxMs);

      if (
        this._notificationsReady &&
        this._mtuNegotiated$.value &&
        this._isGattConnected()
      ) {
        clearTimeout(timer);
        subscription.unsubscribe();
        resolve();
      }
    });
  }
}
