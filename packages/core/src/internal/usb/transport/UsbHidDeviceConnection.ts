import { inject } from "inversify";
import { Left, Right } from "purify-ts";
import { Subject } from "rxjs";

import { ApduResponse } from "@api/device-session/ApduResponse";
import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

import { DeviceConnection, SendApduFnType } from "./DeviceConnection";

type UsbHidDeviceConnectionConstructorArgs = {
  device: HIDDevice;
  apduSender: ApduSenderService;
  apduReceiver: ApduReceiverService;
};

export class UsbHidDeviceConnection implements DeviceConnection {
  private readonly _device: HIDDevice;
  private readonly _apduSender: ApduSenderService;
  private readonly _apduReceiver: ApduReceiverService;
  private _sendApduSubject: Subject<ApduResponse>;
  private readonly _logger: LoggerPublisherService;

  constructor(
    { device, apduSender, apduReceiver }: UsbHidDeviceConnectionConstructorArgs,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._device = device;
    this._apduSender = apduSender;
    this._apduReceiver = apduReceiver;
    this._sendApduSubject = new Subject();
    this._device.oninputreport = this.receiveHidInputReport;
    this._logger = loggerServiceFactory("UsbHidDeviceConnection");
  }

  public get device() {
    return this._device;
  }

  sendApdu: SendApduFnType = async (apdu) => {
    this._sendApduSubject = new Subject();

    this._logger.debug("Sending APDU", {
      data: { apdu },
      tag: "apdu-sender",
    });
    const frames = this._apduSender.getFrames(apdu);
    for (const frame of frames) {
      this._logger.debug("Sending Frame", {
        data: { frame: frame.getRawData() },
      });
      await this._device.sendReport(0, frame.getRawData());
    }

    return new Promise((resolve) => {
      this._sendApduSubject.subscribe({
        next: (r) => {
          resolve(Right(r));
        },
        error: (err) => {
          resolve(Left(err));
        },
      });
    });
  };

  private receiveHidInputReport = (event: HIDInputReportEvent) => {
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
  };
}
