import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { NearAppBinder } from "@internal/app-binder/NearAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: NearAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: NearAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
