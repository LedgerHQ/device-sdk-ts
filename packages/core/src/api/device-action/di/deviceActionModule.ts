import { ContainerModule } from "inversify";

import { ExecuteDeviceActionUseCase } from "@api/device-action/use-case/ExecuteDeviceActionUseCase";
import { StubUseCase } from "@root/src/di.stub";

import { deviceActionTypes } from "./deviceActionTypes";

type DeviceActionModuleArgs = Partial<{
  readonly stub: boolean;
}>;

export const deviceActionModuleFactory = ({
  stub = false,
}: DeviceActionModuleArgs = {}) =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind(deviceActionTypes.ExecuteDeviceActionUseCase).to(
        ExecuteDeviceActionUseCase,
      );
      if (stub) {
        rebind(deviceActionTypes.ExecuteDeviceActionUseCase).to(StubUseCase);
      }
    },
  );
