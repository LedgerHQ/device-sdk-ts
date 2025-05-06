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
  new ContainerModule(({ bind, rebindSync }) => {
    bind(deviceActionTypes.ExecuteDeviceActionUseCase).to(
      ExecuteDeviceActionUseCase,
    );
    if (stub) {
      rebindSync(deviceActionTypes.ExecuteDeviceActionUseCase).to(StubUseCase);
    }
  });
