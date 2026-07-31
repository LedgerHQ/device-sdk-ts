import { inject, injectable } from "inversify";

import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { IcpAppBinder } from "@internal/app-binder/IcpAppBinder";

@injectable()
export class GetAppConfigurationUseCase {
  private readonly _appBinder: IcpAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: IcpAppBinder) {
    this._appBinder = appBinder;
  }

  execute(): GetVersionDAReturnType {
    return this._appBinder.getVersion({
      skipOpenApp: false,
    });
  }
}
