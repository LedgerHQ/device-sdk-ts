import { inject, injectable } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { ConcordiumAppBinder } from "@internal/app-binder/ConcordiumAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class GetAppConfigUseCase {
  private readonly _appBinder: ConcordiumAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: ConcordiumAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(skipOpenApp: boolean = false): GetAppConfigDAReturnType {
    return this._appBinder.getAppConfiguration({ skipOpenApp });
  }
}
