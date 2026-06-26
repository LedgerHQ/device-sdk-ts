import { inject, injectable } from "inversify";

import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TronAppBinder } from "@internal/app-binder/TronAppBinder";

@injectable()
export class GetAppConfigurationUseCase {
  private readonly _appBinder: TronAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: TronAppBinder) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigurationDAReturnType {
    return this._appBinder.getAppConfiguration();
  }
}
