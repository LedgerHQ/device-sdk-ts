import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type AppConfigOptions } from "@api/model/AppConfigOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: HederaAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: HederaAppBinder) {
    this._appBinder = appBinder;
  }

  execute(options?: AppConfigOptions): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfig({
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
