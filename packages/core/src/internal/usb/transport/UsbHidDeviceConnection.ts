import { inject } from "inversify";
import { EitherAsync, Left, Right } from "purify-ts";
import { Subject } from "rxjs";

import { SdkError } from "@api/Error";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";
import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import type { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

type UsbHidDeviceConnectionConstructorArgs = {
  device: HIDDevice;
  apduSender: ApduSenderService;
  apduReceiver: ApduReceiverService;
};

export type SendApduFnType = typeof UsbHidDeviceConnection.prototype.sendApdu;

export class UsbHidDeviceConnection {
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
    this._device.addEventListener("inputreport", this.receiveApdu.bind(this));
    this._logger = loggerServiceFactory("UsbHidDeviceConnection");
  }

  public get device(): HIDDevice {
    return this._device;
  }

  private receiveApdu(event: HIDInputReportEvent) {
    const data = new Uint8Array(event.data.buffer);
    const response = this._apduReceiver.handleFrame(data);
    response.caseOf({
      Right: (maybeApduResponse) => {
        if (maybeApduResponse.isJust()) {
          this._logger.info("Received APDU Response", {
            data: { response: maybeApduResponse.extract() },
          });
          this._sendApduSubject.next(maybeApduResponse.extract());
          this._sendApduSubject.complete();
        }
      },
      Left: (err: SdkError) => {
        this._sendApduSubject.error(err);
      },
    });
  }

  public sendApdu = (apdu: Uint8Array): EitherAsync<SdkError, ApduResponse> => {
    this._sendApduSubject = new Subject();

    return EitherAsync.fromPromise(async () => {
      this._logger.info("Sending APDU", { data: { apdu } });
      const frames = this._apduSender.getFrames(apdu);
      for (const frame of frames) {
        await this._device.sendReport(0, frame.getRawData());
      }
      try {
        const ret = await new Promise<ApduResponse>((resolve, reject) => {
          this._sendApduSubject.subscribe({
            next: (r) => {
              resolve(r);
            },
            error: (err) => {
              reject(err);
            },
          });
        });
        return Right(ret);
      } catch (err) {
        return Left(err as SdkError);
      }
    });
  };
}
