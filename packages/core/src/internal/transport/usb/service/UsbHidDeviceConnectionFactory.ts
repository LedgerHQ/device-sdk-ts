import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import { CHANNEL_LENGTH } from "@internal/device-session/data/FramerConst";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { ApduReceiverService } from "@internal/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@internal/device-session/service/ApduSenderService";
import { DefaultApduReceiverConstructorArgs } from "@internal/device-session/service/DefaultApduReceiverService";
import { DefaultApduSenderServiceConstructorArgs } from "@internal/device-session/service/DefaultApduSenderService";
import { FramerUtils } from "@internal/device-session/utils/FramerUtils";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { FRAME_SIZE } from "@internal/transport/usb/data/UsbHidConfig";
import { UsbHidDeviceConnection } from "@internal/transport/usb/transport/UsbHidDeviceConnection";

@injectable()
export class UsbHidDeviceConnectionFactory {
  randomChannel = Math.floor(Math.random() * 0xffff);

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
      FramerUtils.numberToByteArray(this.randomChannel, CHANNEL_LENGTH),
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
