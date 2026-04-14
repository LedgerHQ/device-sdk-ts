import { ContainerModule } from "inversify";

import { ConcordiumAppBinder } from "@internal/app-binder/ConcordiumAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(ConcordiumAppBinder);
  });
