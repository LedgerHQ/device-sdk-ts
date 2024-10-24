import { type DeviceModelId } from "@api/device/DeviceModel";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";
import { type BleDeviceInfos } from "@internal/transport/ble/model/BleDeviceInfos";

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
