import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";

export class BleDeviceInfos {
  constructor(
    public deviceModel: InternalDeviceModel,
    public serviceUuid: string,
    public writeUuid: string,
    public writeCmdUuid: string,
    public notifyUuid: string,
  ) {}
}
