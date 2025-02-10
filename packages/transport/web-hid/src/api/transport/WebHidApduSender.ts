import {
  type ApduReceiverService,
  type ApduResponse,
  type ApduSenderService,
  type DeviceApduSender,
  type DmkError,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";
import { firstValueFrom, from, retry, Subject } from "rxjs";

import { WebHidSendReportError } from "@api/model/Errors";

type WebHidDeviceConnectionConstructorArgs = {
  device: HIDDevice;
  apduSender: ApduSenderService;
  apduReceiver: ApduReceiverService;
};

/**
 * Class to manage the connection with a USB HID device.
 * It sends APDU commands to the device and receives the responses.
 * It handles temporary disconnections and reconnections.
 */
export class WebHidApduSender implements DeviceApduSender<HIDDevice> {
  private _device: HIDDevice;
  private readonly _apduSender: ApduSenderService;
  private readonly _apduReceiver: ApduReceiverService;
  private _sendApduSubject: Subject<ApduResponse> = new Subject();
  private readonly _logger: LoggerPublisherService;

  constructor(
    { device, apduSender, apduReceiver }: WebHidDeviceConnectionConstructorArgs,
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._apduSender = apduSender;
    this._apduReceiver = apduReceiver;
    this._logger = loggerServiceFactory("WebHidDeviceConnection");
    this._device = device;
    this._device.oninputreport = (event) => this.receiveHidInputReport(event);
    this._logger.info("🔌 Connected to device");
  }

  public async setupConnection() {
    await this._device.open();
    this._device.oninputreport = (event) => this.receiveHidInputReport(event);
  }

  public get device() {
    return this._device;
  }

  public getDependencies() {
    return this._device;
  }

  public setDependencies(device: HIDDevice) {
    this._device = device;
  }

  async sendApdu(apdu: Uint8Array): Promise<Either<DmkError, ApduResponse>> {
    this._sendApduSubject = new Subject();
    this._logger.debug("Sending APDU", {
      data: { apdu },
      tag: "apdu-sender",
    });

    const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => {
        this._sendApduSubject.subscribe({
          next: (r) => {
            resolve(Right(r));
          },
          error: (err) => {
            resolve(Left(err));
          },
        });
      },
    );

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

  public closeConnection() {
    this._device.close();
  }
}
