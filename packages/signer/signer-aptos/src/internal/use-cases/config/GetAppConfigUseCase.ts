import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { AptosAppBinder } from "@internal/app-binder/AptosAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: AptosAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: AptosAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
