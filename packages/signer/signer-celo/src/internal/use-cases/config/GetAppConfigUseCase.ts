import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { CeloAppBinder } from "@internal/app-binder/CeloAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: CeloAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: CeloAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
