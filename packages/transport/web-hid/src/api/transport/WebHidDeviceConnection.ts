import {
  type ApduReceiverService,
  type ApduResponse,
  type ApduSenderService,
  CommandUtils,
  type DeviceConnection,
  type DeviceId,
  type DmkError,
  type LoggerPublisherService,
  ReconnectionFailedError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";
import { firstValueFrom, from, retry, Subject } from "rxjs";

import { RECONNECT_DEVICE_TIMEOUT } from "@api/data/WebHidConfig";
import { WebHidSendReportError } from "@api/model/Errors";

type WebHidDeviceConnectionConstructorArgs = {
  device: HIDDevice;
  deviceId: DeviceId;
  apduSender: ApduSenderService;
  apduReceiver: ApduReceiverService;
  onConnectionTerminated: () => void;
};

type Timer = ReturnType<typeof setTimeout>;

/**
 * Class to manage the connection with a USB HID device.
 * It sends APDU commands to the device and receives the responses.
 * It handles temporary disconnections and reconnections.
 */
export class WebHidDeviceConnection implements DeviceConnection {
  private _device: HIDDevice;
  private _deviceId: DeviceId;
  private readonly _apduSender: ApduSenderService;
  private readonly _apduReceiver: ApduReceiverService;
  private _sendApduSubject: Subject<ApduResponse> = new Subject();
  private readonly _logger: LoggerPublisherService;
  private _pendingApdu: Maybe<Uint8Array> = Nothing;

  /** Callback to notify the connection termination */
  private _onConnectionTerminated: () => void;
  /** Subject to notify the reconnection status */
  private reconnectionSubject: Subject<"success" | DmkError> = new Subject();
  /** Flag to indicate if the connection is waiting for a reconnection */
  private waitingForReconnection = false;
  /** Timeout to wait for the device to reconnect */
  private lostConnectionTimeout: Timer | null = null;
  /** Flag to indicate if the connection is terminated */
  private terminated = false;

  constructor(
    {
      device,
      deviceId,
      apduSender,
      apduReceiver,
      onConnectionTerminated,
    }: WebHidDeviceConnectionConstructorArgs,
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._apduSender = apduSender;
    this._apduReceiver = apduReceiver;
    this._onConnectionTerminated = onConnectionTerminated;
    this._logger = loggerServiceFactory("WebHidDeviceConnection");
    this._device = device;
    this._device.oninputreport = (event) => this.receiveHidInputReport(event);
    this._deviceId = deviceId;
    this._logger.info("🔌 Connected to device");
  }

  public get device() {
    return this._device;
  }

  public get deviceId() {
    return this._deviceId;
  }

  async sendApdu(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
  ): Promise<Either<DmkError, ApduResponse>> {
    this._sendApduSubject = new Subject();
    this._pendingApdu = Maybe.of(apdu);
    this._logger.debug("Sending APDU", {
      data: { apdu },
      tag: "apdu-sender",
    });

    const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => {
        this._sendApduSubject.subscribe({
          next: async (r) => {
            this._pendingApdu = Nothing;
            if (triggersDisconnection && CommandUtils.isSuccessResponse(r)) {
              // Anticipate the disconnection and wait for the reconnection before resolving
              const reconnectionRes = await this.waitForReconnection();
              reconnectionRes.caseOf({
                Left: (err) => resolve(Left(err)),
                Right: () => resolve(Right(r)),
              });
            } else {
              resolve(Right(r));
            }
          },
          error: (err) => {
            this._pendingApdu = Nothing;
            resolve(Left(err));
          },
        });
      },
    );

    if (this.waitingForReconnection || !this.device.opened) {
      const waitingForDeviceResponse =
        this.device.opened && this._pendingApdu.isJust();
      const reconnectionRes = await this.waitForReconnection(
        waitingForDeviceResponse,
      );
      if (reconnectionRes.isLeft()) {
        return reconnectionRes;
      }
    }

    const frames = this._apduSender.getFrames(apdu);
    for (const frame of frames) {
      this._logger.debug("Sending Frame", {
        data: { frame: frame.getRawData() },
      });

      try {
        await firstValueFrom(
          from(this._device.sendReport(0, frame.getRawData())).pipe(
            retry({
              count: 3,
              delay: 500,
            }),
          ),
        );
      } catch (error) {
        this._logger.error("Error sending frame", { data: { error } });
        return Promise.resolve(Left(new WebHidSendReportError(error)));
      }
    }

    return resultPromise;
  }

  private receiveHidInputReport(event: HIDInputReportEvent) {
    const data = new Uint8Array(event.data.buffer);
    this._logger.debug("Received Frame", {
      data: { frame: data },
      tag: "apdu-receiver",
    });
    const response = this._apduReceiver.handleFrame(data);
    response.caseOf({
      Right: (maybeApduResponse) => {
        maybeApduResponse.map((apduResponse) => {
          this._logger.debug("Received APDU Response", {
            data: { response: apduResponse },
          });
          this._sendApduSubject.next(apduResponse);
          this._sendApduSubject.complete();
        });
      },
      Left: (err) => {
        this._sendApduSubject.error(err);
      },
    });
  }

  private waitForReconnection(
    waitingForDeviceResponse: boolean = false,
  ): Promise<Either<DmkError, void>> {
    if (this.terminated) {
      return Promise.resolve(Left(new ReconnectionFailedError()));
    }

    return new Promise<Either<DmkError, void>>((resolve) => {
      const sub = this.reconnectionSubject.subscribe({
        next: (res) => {
          if (waitingForDeviceResponse) {
            this._sendApduSubject.error(
              new WebHidSendReportError(
                new Error(
                  "Device disconnected while waiting for device response",
                ),
              ),
            );
          }

          if (res === "success") {
            resolve(Right(undefined));
          } else {
            resolve(Left(res));
          }

          sub.unsubscribe();
        },
      });
    });
  }

  /**
   * Method called when the HIDDevice gets disconnected.
   * It starts a timeout to wait for the device to reconnect.
   * */
  public lostConnection() {
    this._logger.info("⏱️ Lost connection, starting timer");
    this.waitingForReconnection = true;
    this.lostConnectionTimeout = setTimeout(() => {
      this._logger.info("❌ Disconnection timeout, terminating connection");
      this.disconnect();
    }, RECONNECT_DEVICE_TIMEOUT);
  }

  /** Reconnect the device after a disconnection */
  public async reconnectHidDevice(device: HIDDevice) {
    this._device = device;
    this._device.oninputreport = (event) => this.receiveHidInputReport(event);

    if (this.lostConnectionTimeout) {
      clearTimeout(this.lostConnectionTimeout);
    }

    if (this._pendingApdu.isJust()) {
      this._sendApduSubject.error(new WebHidSendReportError());
    }

    await device.open();

    this._logger.info("⏱️🔌 Device reconnected");
    this.waitingForReconnection = false;
    this.reconnectionSubject.next("success");
  }

  public disconnect() {
    if (this._pendingApdu.isJust()) {
      this._sendApduSubject.error(new WebHidSendReportError());
    }

    this._logger.info("🔚 Disconnect");
    if (this.lostConnectionTimeout) clearTimeout(this.lostConnectionTimeout);
    this.terminated = true;
    this._onConnectionTerminated();
    this.reconnectionSubject.next(new ReconnectionFailedError());
  }
}
