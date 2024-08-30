import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";

export interface BleDeviceInfos {
  deviceModel: InternalDeviceModel;
  serviceUuid: string;
  writeUuid: string;
  writeCmdUuid: string;
  notifyUuid: string;
}
