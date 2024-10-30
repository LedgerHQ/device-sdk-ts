import { type ApduReceiverServiceFactory } from "@api/device-session/service/ApduReceiverService";
import { type ApduSenderServiceFactory } from "@api/device-session/service/ApduSenderService";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { BleDeviceConnection } from "@internal/transport/ble/transport/BleDeviceConnection";

export class BleDeviceConnectionFactory {
  constructor(
    private readonly apduSenderFactory: ApduSenderServiceFactory,
    private readonly apduReceiverFactory: ApduReceiverServiceFactory,
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
