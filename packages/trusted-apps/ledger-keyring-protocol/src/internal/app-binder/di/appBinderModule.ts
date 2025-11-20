import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { LedgerKeyRingProtocolBinder } from "@internal/app-binder/LedgerKeyRingProtocolBinder";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(LedgerKeyRingProtocolBinder);
  });
