import { ContainerModule } from "inversify";

import { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";

export const btcLegacyModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(btcLegacyTypes.AppBinder).to(BtcLegacyAppBinder);
  });
