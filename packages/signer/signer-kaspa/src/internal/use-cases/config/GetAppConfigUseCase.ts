import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { KaspaAppBinder } from "@internal/app-binder/KaspaAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: KaspaAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: KaspaAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
