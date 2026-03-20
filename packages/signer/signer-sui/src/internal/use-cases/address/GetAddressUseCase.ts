import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SuiAppBinder } from "@internal/app-binder/SuiAppBinder";

@injectable()
export class GetAddressUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: SuiAppBinder,
  ) {}

  execute(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this.appBinder.getAddress({
      derivationPath,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
