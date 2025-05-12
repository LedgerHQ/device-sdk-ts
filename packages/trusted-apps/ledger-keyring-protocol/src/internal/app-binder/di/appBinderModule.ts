import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { LedgerKeyringProtocolBinder } from "@internal/app-binder/LedgerKeyringProtocolBinder";

export const appBindingModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinding).to(LedgerKeyringProtocolBinder);
  });
