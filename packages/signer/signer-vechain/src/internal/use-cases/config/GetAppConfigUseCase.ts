import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { VechainAppBinder } from "@internal/app-binder/VechainAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: VechainAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: VechainAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
