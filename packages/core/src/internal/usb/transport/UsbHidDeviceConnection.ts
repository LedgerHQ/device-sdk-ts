import { inject } from "inversify";
import { Either, Left, Maybe, Right } from "purify-ts";
import { Subject } from "rxjs";

import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { SdkError } from "@api/Error";
import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { RECONNECT_DEVICE_TIMEOUT } from "@internal/usb/data/UsbHidConfig";
import {
  HidSendReportError,
  ReconnectionFailedError,
} from "@internal/usb/model/Errors";

import { DeviceConnection } from "./DeviceConnection";

type UsbHidDeviceConnectionConstructorArgs = {
  device: HIDDevice;
  apduSender: ApduSenderService;
  apduReceiver: ApduReceiverService;
  onConnectionTerminated: () => void;
};

export class UsbHidDeviceConnection implements DeviceConnection {
  private _device: HIDDevice;
  private readonly _apduSender: ApduSenderService;
  private readonly _apduReceiver: ApduReceiverService;
  private _sendApduSubject: Subject<ApduResponse>;
  private readonly _logger: LoggerPublisherService;
  private _settleReconnectionPromise: Maybe<{
    resolve(): void;
    reject(err: SdkError): void;
  }> = Maybe.zero();
  private _onConnectionTerminated: () => void;
  private _terminated = false;

  constructor(
    {
      device,
      apduSender,
      apduReceiver,
      onConnectionTerminated,
    }: UsbHidDeviceConnectionConstructorArgs,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._apduSender = apduSender;
    this._apduReceiver = apduReceiver;
    this._onConnectionTerminated = onConnectionTerminated;
    this._sendApduSubject = new Subject();
    this._logger = loggerServiceFactory("UsbHidDeviceConnection");
    this._device = device;
    this._device.oninputreport = (event) => this.receiveHidInputReport(event);
  }

  public get device() {
    return this._device;
  }

  public set device(device: HIDDevice) {
    this._device = device;
    this._device.oninputreport = (event) => this.receiveHidInputReport(event);

    if (this.lostConnectionTimeout) {
      this._logger.debug(
        "Device reconnected, clearing lost connection timeout",
      );
      clearTimeout(this.lostConnectionTimeout);
    }
    this._settleReconnectionPromise.ifJust(() => {
      this.reconnected();
    });
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

    while (!this.device.opened && !this._terminated) {
      this._logger.debug("Waiting for device to be opened");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (this._terminated) {
      this._logger.debug("Connection terminated, failing sendApdu");
      return Promise.resolve(Left(new ReconnectionFailedError()));
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
    return new Promise<Either<SdkError, void>>((resolve) => {
      this._settleReconnectionPromise = Maybe.of({
        resolve: () => resolve(Right(undefined)),
        reject: (error: SdkError) => resolve(Left(error)),
      });
    });
  }

  private lostConnectionTimeout: NodeJS.Timeout | null = null;
  public lostConnection() {
    this._logger.debug("Lost connection");
    this.lostConnectionTimeout = setTimeout(() => {
      this._logger.debug("Lost connection timeout");
      this.disconnect();
    }, RECONNECT_DEVICE_TIMEOUT);
  }

  private reconnected() {
    this._settleReconnectionPromise.ifJust((promise) => {
      promise.resolve();
      this._settleReconnectionPromise = Maybe.zero();
    });
  }

  public disconnect() {
    this._logger.debug("Disconnect");
    this._terminated = true;
    if (this.lostConnectionTimeout) clearTimeout(this.lostConnectionTimeout);
    this._onConnectionTerminated();
    this._settleReconnectionPromise.ifJust((promise) => {
      promise.reject(new ReconnectionFailedError());
      this._settleReconnectionPromise = Maybe.zero();
    });
  }
}
