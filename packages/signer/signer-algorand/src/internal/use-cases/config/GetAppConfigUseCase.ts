import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { AlgorandAppBinder } from "@internal/app-binder/AlgorandAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: AlgorandAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: AlgorandAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
