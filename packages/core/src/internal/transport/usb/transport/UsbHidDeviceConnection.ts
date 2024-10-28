import { Either, Left, Right } from "purify-ts";
import { Subject } from "rxjs";

import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { SdkError } from "@api/Error";
import { DeviceId } from "@api/types";
import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { DeviceConnection } from "@internal/transport/model/DeviceConnection";
import { ReconnectionFailedError } from "@internal/transport/model/Errors";
import { HidSendReportError } from "@internal/transport/model/Errors";
import { RECONNECT_DEVICE_TIMEOUT } from "@internal/transport/usb/data/UsbHidConfig";

type UsbHidDeviceConnectionConstructorArgs = {
  device: HIDDevice;
  deviceId: DeviceId;
  apduSender: ApduSenderService;
  apduReceiver: ApduReceiverService;
  onConnectionTerminated: () => void;
  loggerFactory: (name: string) => LoggerPublisherService;
};

/**
 * Class to manage the connection with a USB HID device.
 * It sends APDU commands to the device and receives the responses.
 * It handles temporary disconnections and reconnections.
 */
export class UsbHidDeviceConnection implements DeviceConnection {
  private _device: HIDDevice;
  private _deviceId: DeviceId;
  private readonly _apduSender: ApduSenderService;
  private readonly _apduReceiver: ApduReceiverService;
  private _sendApduSubject: Subject<ApduResponse> = new Subject();
  private readonly _logger: LoggerPublisherService;

  /** Callback to notify the connection termination */
  private _onConnectionTerminated: () => void;
  /** Subject to notify the reconnection status */
  private reconnectionSubject: Subject<"success" | SdkError> = new Subject();
  /** Flag to indicate if the connection is waiting for a reconnection */
  private waitingForReconnection = false;
  /** Timeout to wait for the device to reconnect */
  private lostConnectionTimeout: NodeJS.Timeout | null = null;
  /** Flag to indicate if the connection is terminated */
  private terminated = false;

  constructor({
    device,
    deviceId,
    apduSender,
    apduReceiver,
    onConnectionTerminated,
    loggerFactory,
  }: UsbHidDeviceConnectionConstructorArgs) {
    this._apduSender = apduSender;
    this._apduReceiver = apduReceiver;
    this._onConnectionTerminated = onConnectionTerminated;
    this._logger = loggerFactory("UsbHidDeviceConnection");
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
  ): Promise<Either<SdkError, ApduResponse>> {
    this._sendApduSubject = new Subject();

    this._logger.debug("Sending APDU", {
      data: { apdu },
      tag: "apdu-sender",
    });

    const resultPromise = new Promise<Either<SdkError, ApduResponse>>(
      (resolve) => {
        this._sendApduSubject.subscribe({
          next: async (r) => {
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
            resolve(Left(err));
          },
        });
      },
    );

    if (this.waitingForReconnection || !this.device.opened) {
      const reconnectionRes = await this.waitForReconnection();
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
        await this._device.sendReport(0, frame.getRawData());
      } catch (error) {
        this._logger.error("Error sending frame", { data: { error } });
        return Promise.resolve(Left(new HidSendReportError(error)));
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

  private waitForReconnection(): Promise<Either<SdkError, void>> {
    if (this.terminated)
      return Promise.resolve(Left(new ReconnectionFailedError()));
    return new Promise<Either<SdkError, void>>((resolve) => {
      const sub = this.reconnectionSubject.subscribe({
        next: (res) => {
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
      this._logger.info("⏱️🔌 Device reconnected");
      clearTimeout(this.lostConnectionTimeout);
    }
    await device.open();
    this.waitingForReconnection = false;
    this.reconnectionSubject.next("success");
  }

  public disconnect() {
    this._logger.info("🔚 Disconnect");
    if (this.lostConnectionTimeout) clearTimeout(this.lostConnectionTimeout);
    this.terminated = true;
    this._onConnectionTerminated();
    this.reconnectionSubject.next(new ReconnectionFailedError());
  }
}
