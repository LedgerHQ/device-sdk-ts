import { inject, injectable } from "inversify";

import { type GetTvkDAReturnType } from "@api/app-binder/GetTvkDeviceActionTypes";
import { type GetTvkOptions } from "@api/model/GetTvkOptions";
import { AleoAppBinder } from "@internal/app-binder/AleoAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class GetTvkUseCase {
  private readonly _appBinder: AleoAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: AleoAppBinder) {
    this._appBinder = appBinder;
  }

  execute(derivationPath: string, options?: GetTvkOptions): GetTvkDAReturnType {
    return this._appBinder.getTvk({
      derivationPath,
      transitionIndex: options?.transitionIndex,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
