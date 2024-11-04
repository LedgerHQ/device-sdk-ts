import { inject, injectable } from "inversify";

import { GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

@injectable()
export class GetAppConfigurationUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: SolanaAppBinder,
  ) {}

  execute(): GetAppConfigurationDAReturnType {
    return this.appBinder.getAppConfiguration();
  }
}
