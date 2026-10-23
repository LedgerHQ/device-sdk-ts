import { ContainerModule } from "inversify";

import { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";
import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";

export const btcLegacyModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(btcLegacyTypes.AppBinder).to(BtcLegacyAppBinder);
    bind(btcLegacyTypes.GetAddressUseCase).to(GetAddressUseCase);
  });
