import { ContainerModule } from "inversify";

import { AppBindingEth } from "@internal/app-binding/AppBindingEth";
import { appBindingTypes } from "@internal/app-binding/di/appBindingTypes";

export const appBindingModuleFactory = () =>
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
      bind(appBindingTypes.AppBinding).to(AppBindingEth);
    },
  );
