import { ContainerModule } from "inversify";

import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SignPsbtTask } from "@internal/app-binder/task/SignPsbtTask";

export const appBinderModuleFactory = () =>
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
      bind(appBinderTypes.AppBinder).to(BtcAppBinder);
      bind(appBinderTypes.SignPsbtTask).to(SignPsbtTask);
    },
  );
