import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { IconAppBinder } from "@internal/app-binder/IconAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: IconAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: IconAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
