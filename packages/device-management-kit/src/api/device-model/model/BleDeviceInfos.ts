import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";

export class BleDeviceInfos {
  constructor(
    public deviceModel: TransportDeviceModel,
    public serviceUuid: string,
    public writeUuid: string,
    public writeCmdUuid: string,
    public notifyUuid: string,
  ) {}
}
