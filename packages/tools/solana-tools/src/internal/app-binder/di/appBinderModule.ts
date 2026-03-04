import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SolanaToolsAppBinder } from "@internal/app-binder/SolanaToolsAppBinder";

export const appBinderModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinder).to(SolanaToolsAppBinder);
  });
