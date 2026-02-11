import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { PolkadotAppBinder } from "@internal/app-binder/PolkadotAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: PolkadotAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: PolkadotAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: false,
    });
  }
}
