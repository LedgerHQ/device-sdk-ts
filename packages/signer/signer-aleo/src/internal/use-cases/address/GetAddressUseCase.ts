import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { AleoAppBinder } from "@internal/app-binder/AleoAppBinder";

@injectable()
export class GetAddressUseCase {
  private readonly _appBinder: AleoAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: AleoAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._appBinder.getAddress({
      derivationPath,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
