import { inject, injectable } from "inversify";

import { type GetViewKeyDAReturnType } from "@api/app-binder/GetViewKeyDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { AleoAppBinder } from "@internal/app-binder/AleoAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class GetViewKeyUseCase {
  private readonly _appBinder: AleoAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: AleoAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    options?: AddressOptions,
  ): GetViewKeyDAReturnType {
    return this._appBinder.getViewKey({
      derivationPath,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
