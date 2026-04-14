import { ContainerModule } from "inversify";

import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { BlockhashService } from "@internal/app-binder/services/BlockhashService";
import { SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

export const appBinderModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinder).to(SolanaAppBinder);
    bind(appBinderTypes.BlockhashService).to(BlockhashService);
  });
