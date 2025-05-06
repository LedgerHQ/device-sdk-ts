import { ContainerModule } from "inversify";

import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

export const appBinderModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinder).to(BtcAppBinder);
  });
