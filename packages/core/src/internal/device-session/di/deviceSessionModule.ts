import { ContainerModule } from "inversify";

import { DefaultFramerService } from "@internal/device-session/service/DefaultFramerService";

import { types } from "./deviceSessionTypes";

export const deviceSessionModuleFactory = () =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      _rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind(types.FramerService).to(DefaultFramerService);
    },
  );
