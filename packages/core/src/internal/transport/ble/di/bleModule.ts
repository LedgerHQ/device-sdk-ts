import { ContainerModule } from "inversify";

import { BleDeviceConnectionFactory } from "@internal/transport/ble/service/BleDeviceConnectionFactory";

import { bleDiTypes } from "./bleDiTypes";

export const bleModuleFactory = () =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(bleDiTypes.BleDeviceConnectionFactory).to(BleDeviceConnectionFactory);
  });
