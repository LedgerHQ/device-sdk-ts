import {
  DeviceModel,
  DeviceModelId,
} from "@internal/device-model/model/DeviceModel";

/**
 * Source of truth for the device models
 */
export interface DeviceModelDataSource {
  getAllDeviceModels(): DeviceModel[];

  getDeviceModel(params: { id: DeviceModelId }): DeviceModel;

  filterDeviceModels(params: Partial<DeviceModel>): DeviceModel[];
}
