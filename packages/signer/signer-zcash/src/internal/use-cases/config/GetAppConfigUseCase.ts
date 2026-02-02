import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: ZcashAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: ZcashAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
