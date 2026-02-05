import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { StellarAppBinder } from "@internal/app-binder/StellarAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: StellarAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: StellarAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
