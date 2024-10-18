import { DeviceModelId } from "@api/device/DeviceModel";
import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";
import { BleDeviceInfos } from "@internal/transport/ble/model/BleDeviceInfos";

/**
 * Source of truth for the device models
 */
export interface DeviceModelDataSource {
  getAllDeviceModels(): InternalDeviceModel[];

  getDeviceModel(params: { id: DeviceModelId }): InternalDeviceModel;

  filterDeviceModels(
    params: Partial<InternalDeviceModel>,
  ): InternalDeviceModel[];

  getBluetoothServicesInfos(): Record<string, BleDeviceInfos>;

  getBluetoothServices(): string[];
}
