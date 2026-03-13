import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { AddressOptions } from "@api/SignerCosmos";
import { CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class GetAddressUseCase {
  private readonly _appBinder: CosmosAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: CosmosAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    hrp: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._appBinder.getAddress({
      derivationPath,
      hrp,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
