import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { XrpAppBinder } from "@internal/app-binder/XrpAppBinder";

@injectable()
export class GetAddressUseCase {
  private readonly _appBinder: XrpAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: XrpAppBinder,
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
      returnChainCode: options?.returnChainCode ?? false,
      useEd25519: options?.useEd25519 ?? false,
    });
  }
}
