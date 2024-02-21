import { ContainerModule } from "inversify";

import { StaticDeviceModelDataSource } from "@internal/device-model/data/StaticDeviceModelDataSource";

import { deviceModelDiTypes } from "./deviceModelDiTypes";

type FactoryProps = {
  stub: boolean;
};

export const deviceModelModuleFactory = ({
  stub = false,
}: Partial<FactoryProps> = {}) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(deviceModelDiTypes.DeviceModelDataSource).to(
      StaticDeviceModelDataSource,
    );

    if (stub) {
      // We can rebind our interfaces to their mock implementations
      // rebind(...).to(....);
    }
  });
