import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TezosAppBinder } from "@internal/app-binder/TezosAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: TezosAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: TezosAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
