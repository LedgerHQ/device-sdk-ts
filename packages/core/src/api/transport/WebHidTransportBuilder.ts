import { TransportInitializationError } from "@api/Error";
import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
import { CHANNEL_LENGTH } from "@internal/device-session/data/FramerConst";
import { DefaultApduReceiverService } from "@internal/device-session/service/DefaultApduReceiverService";
import { DefaultApduSenderService } from "@internal/device-session/service/DefaultApduSenderService";
import { FramerUtils } from "@internal/device-session/utils/FramerUtils";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { FRAME_SIZE } from "@internal/transport/usb/data/UsbHidConfig";
import { WebUsbHidTransport } from "@internal/transport/usb/transport/WebUsbHidTransport";

import { TransportBuilder } from "./model/TransportBuilder";

export class WebHidTransportBuilder
  implements TransportBuilder<WebUsbHidTransport>
{
  private readonly _randomChannel: Uint8Array = FramerUtils.numberToByteArray(
    Math.floor(Math.random() * 0xffff),
    CHANNEL_LENGTH,
  );
  private _loggerFactory?: (name: string) => LoggerPublisherService;
  private _deviceModelDataSource?: DeviceModelDataSource;

  setLoggerFactory(
    loggerFactory: (name: string) => LoggerPublisherService,
  ): TransportBuilder<WebUsbHidTransport> {
    this._loggerFactory = loggerFactory;
    return this;
  }
  setDeviceModelDataSource(
    deviceModelDataSource: DeviceModelDataSource,
  ): TransportBuilder<WebUsbHidTransport> {
    this._deviceModelDataSource = deviceModelDataSource;
    return this;
  }
  setConfig(): TransportBuilder<WebUsbHidTransport> {
    throw new Error("Method not implemented.");
  }
  build(): WebUsbHidTransport {
    if (!this._loggerFactory) {
      throw new TransportInitializationError(
        "Missing logger publisher factory",
      );
    }
    if (!this._deviceModelDataSource) {
      throw new TransportInitializationError("Missing deviceModelDataSource");
    }
    const apduSender = new DefaultApduSenderService({
      frameSize: FRAME_SIZE,
      loggerFactory: this._loggerFactory,
      channel: this._randomChannel,
      padding: true,
    });
    const apduReceiver = new DefaultApduReceiverService({
      channel: this._randomChannel,
      loggerFactory: this._loggerFactory,
    });

    return new WebUsbHidTransport(
      apduSender,
      apduReceiver,
      this._deviceModelDataSource,
      this._loggerFactory,
    );
  }
}
