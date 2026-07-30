import { inject, injectable } from "inversify";

import { type GetShieldedAddressDAReturnType } from "@api/app-binder/GetShieldedAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

@injectable()
export class GetShieldedAddressUseCase {
  private readonly _appBinder: ZcashAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: ZcashAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    options?: AddressOptions,
  ): GetShieldedAddressDAReturnType {
    return this._appBinder.getShieldedAddress({
      derivationPath,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
