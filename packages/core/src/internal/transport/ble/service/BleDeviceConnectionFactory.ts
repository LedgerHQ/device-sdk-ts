import { inject, injectable } from "inversify";

import { ApduReceiverService } from "@api/device-session/service/ApduReceiverService";
import { ApduSenderService } from "@api/device-session/service/ApduSenderService";
import { DefaultApduSenderServiceConstructorArgs } from "@api/device-session/service/DefaultApduSenderService";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
import { BleDeviceConnection } from "@internal/transport/ble/transport/BleDeviceConnection";

@injectable()
export class BleDeviceConnectionFactory {
  constructor(
    @inject(deviceSessionTypes.ApduSenderServiceFactory)
    private readonly apduSenderFactory: (
      args: DefaultApduSenderServiceConstructorArgs,
    ) => ApduSenderService,
    @inject(deviceSessionTypes.ApduReceiverServiceFactory)
    private readonly apduReceiverFactory: () => ApduReceiverService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    private readonly loggerFactory: (name: string) => LoggerPublisherService,
  ) {}

  public create(
    writeCharacteristic: BluetoothRemoteGATTCharacteristic,
    notifyCharacteristic: BluetoothRemoteGATTCharacteristic,
  ): BleDeviceConnection {
    return new BleDeviceConnection(
      {
        writeCharacteristic,
        notifyCharacteristic,
        apduSenderFactory: this.apduSenderFactory,
        apduReceiverFactory: this.apduReceiverFactory,
      },
      this.loggerFactory,
    );
  }
}
