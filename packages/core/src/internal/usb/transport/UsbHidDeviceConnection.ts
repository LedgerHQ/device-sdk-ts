import { inject } from "inversify";
import { Either, Left, Right } from "purify-ts";

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

export type SendApduFnType = (
  apdu: Uint8Array,
) => Promise<Either<SdkError, ApduResponse>>;

export class UsbHidDeviceConnection {
  private readonly _device: HIDDevice;
  private readonly _apduSender: ApduSenderService;
  private readonly _apduReceiver: ApduReceiverService;
  private readonly _logger: LoggerPublisherService;
  private _resolve: (value: Either<SdkError, ApduResponse>) => void;

  constructor(
    { device, apduSender, apduReceiver }: UsbHidDeviceConnectionConstructorArgs,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._device = device;
    this._apduSender = apduSender;
    this._apduReceiver = apduReceiver;
    this._device.addEventListener("inputreport", this.receiveApdu);
    this._logger = loggerServiceFactory("UsbHidDeviceConnection");
  }

  public get device() {
    return this._device;
  }

  private receiveApdu = (event: HIDInputReportEvent) => {
    const data = new Uint8Array(event.data.buffer);
    const response = this._apduReceiver.handleFrame(data);
    response.caseOf({
      Right: (maybeApduResponse) => {
        maybeApduResponse.map((apduResponse) => {
          this._logger.info("Received APDU Response", {
            data: { response: apduResponse },
          });
          this._resolve(Right(apduResponse));
        });
      },
      Left: (err: SdkError) => {
        this._resolve(Left(err));
      },
    });
  };

  public sendApdu: SendApduFnType = async (apdu) => {
    const promise = new Promise<Either<SdkError, ApduResponse>>((res) => {
      this._resolve = res;
    });

    this._logger.info("Sending APDU", { data: { apdu } });
    const frames = this._apduSender.getFrames(apdu);
    for (const frame of frames) {
      await this._device.sendReport(0, frame.getRawData());
    }

    return await promise;
  };
}
