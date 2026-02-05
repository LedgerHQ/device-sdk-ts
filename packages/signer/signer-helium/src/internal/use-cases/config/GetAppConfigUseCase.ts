import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { HeliumAppBinder } from "@internal/app-binder/HeliumAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: HeliumAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: HeliumAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
