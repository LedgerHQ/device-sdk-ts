import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { ConcordiumAppBinder } from "@internal/app-binder/ConcordiumAppBinder";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(ConcordiumAppBinder);
  });
