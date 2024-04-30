import { DeviceModelId } from "@api/device/DeviceModel";
import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";

/**
 * Source of truth for the device models
 */
export interface DeviceModelDataSource {
  getAllDeviceModels(): InternalDeviceModel[];

  getDeviceModel(params: { id: DeviceModelId }): InternalDeviceModel;

  filterDeviceModels(
    params: Partial<InternalDeviceModel>,
  ): InternalDeviceModel[];
}
