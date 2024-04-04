import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { DefaultApduReceiverConstructorArgs } from "@internal/device-session/service/DefaultApduReceiverService";
import { DefaultApduSenderServiceConstructorArgs } from "@internal/device-session/service/DefaultApduSenderService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { FRAME_SIZE } from "@internal/usb/data/UsbHidConfig";
import { UsbHidDeviceConnection } from "@internal/usb/transport/UsbHidDeviceConnection";

@injectable()
export class UsbHidDeviceConnectionFactory {
  randomChannel = Math.random() * 0x1000;

  constructor(
    @inject(deviceSessionTypes.ApduSenderServiceFactory)
    private readonly apduSenderFactory: (
      args: DefaultApduSenderServiceConstructorArgs,
    ) => ApduSenderService,
    @inject(deviceSessionTypes.ApduReceiverServiceFactory)
    private readonly apduReceiverFactory: (
      args: DefaultApduReceiverConstructorArgs,
    ) => ApduReceiverService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (name: string) => LoggerPublisherService,
  ) {}

  public create(
    device: HIDDevice,
    channel = Maybe.of(
      new Uint8Array([this.randomChannel / 0xff, this.randomChannel & 0xff]),
    ),
  ): UsbHidDeviceConnection {
    return new UsbHidDeviceConnection(
      {
        device,
        apduSender: this.apduSenderFactory({
          frameSize: FRAME_SIZE,
          channel,
          padding: true,
        }),
        apduReceiver: this.apduReceiverFactory({ channel }),
      },
      this.loggerFactory,
    );
  }
}
