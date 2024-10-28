import { Maybe } from "purify-ts";

import { CHANNEL_LENGTH } from "@api/device-session/model/FramerConst";
import { ApduReceiverServiceFactory } from "@api/device-session/service/ApduReceiverService";
import { ApduSenderServiceFactory } from "@api/device-session/service/ApduSenderService";
import { DeviceId } from "@api/types";
import { FramerUtils } from "@internal/device-session/utils/FramerUtils";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { FRAME_SIZE } from "@internal/transport/usb/data/WebHidConfig";
import { WebHidDeviceConnection } from "@internal/transport/usb/transport/WebHidDeviceConnection";

export class WebHidDeviceConnectionFactory {
  randomChannel = Math.floor(Math.random() * 0xffff);

  constructor(
    private readonly apduSenderFactory: ApduSenderServiceFactory,
    private readonly apduReceiverFactory: ApduReceiverServiceFactory,
    private readonly loggerFactory: (name: string) => LoggerPublisherService,
  ) {}

  public create(
    device: HIDDevice,
    params: { onConnectionTerminated: () => void; deviceId: DeviceId },
    channel = Maybe.of(
      FramerUtils.numberToByteArray(this.randomChannel, CHANNEL_LENGTH),
    ),
  ): WebHidDeviceConnection {
    return new WebHidDeviceConnection(
      {
        device,
        deviceId: params.deviceId,
        apduSender: this.apduSenderFactory({
          frameSize: FRAME_SIZE,
          channel,
          padding: true,
        }),
        apduReceiver: this.apduReceiverFactory({ channel }),
        onConnectionTerminated: params.onConnectionTerminated,
      },
      this.loggerFactory,
    );
  }
}
