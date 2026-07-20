import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/SignerIcp";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { IcpAppBinder } from "@internal/app-binder/IcpAppBinder";

@injectable()
export class GetAddressUseCase {
  private readonly _appBinder: IcpAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: IcpAppBinder) {
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
