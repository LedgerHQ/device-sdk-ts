import { ContainerModule } from "inversify";

import { StaticDeviceModelDataSource } from "@api/device-model/data/StaticDeviceModelDataSource";

import { deviceModelTypes } from "./deviceModelTypes";

type FactoryProps = {
  stub: boolean;
};

export const deviceModelModuleFactory = ({ stub }: FactoryProps) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(deviceModelTypes.DeviceModelDataSource).to(
      StaticDeviceModelDataSource,
    );

    if (stub) {
      // We can rebind our interfaces to their mock implementations
      // rebind(...).to(....);
    }
  });
