import { type DeviceModelId } from "@api/device/DeviceModel";
import { type BleDeviceInfos } from "@api/device-model/model/BleDeviceInfos";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";

/**
 * Source of truth for the device models
 */
export interface DeviceModelDataSource {
  getAllDeviceModels(): TransportDeviceModel[];

  getDeviceModel(params: { id: DeviceModelId }): TransportDeviceModel;

  filterDeviceModels(
    params: Partial<TransportDeviceModel>,
  ): TransportDeviceModel[];

  getBluetoothServicesInfos(): Record<string, BleDeviceInfos>;

  getBluetoothServices(): string[];
}
