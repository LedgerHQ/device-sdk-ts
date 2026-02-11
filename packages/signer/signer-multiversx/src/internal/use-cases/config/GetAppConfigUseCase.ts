import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { MultiversxAppBinder } from "@internal/app-binder/MultiversxAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: MultiversxAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: MultiversxAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
