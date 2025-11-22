import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class GetAddressUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: CosmosAppBinder,
  ) {}

  execute(
    derivationPath: string,
    prefix: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this.appBinder.getAddress({
      derivationPath,
      prefix,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
