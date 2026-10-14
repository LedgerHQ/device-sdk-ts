import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";

@injectable()
export class GetAddressUseCase<ErrorCodes extends string> {
  private readonly _appBinder: BtcLegacyAppBinder<ErrorCodes>;

  constructor(
    @inject(btcLegacyTypes.AppBinder)
    appBinder: BtcLegacyAppBinder<ErrorCodes>,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType<ErrorCodes> {
    return this._appBinder.getAddress({
      derivationPath,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
      addressFormat: options?.addressFormat,
    });
  }
}
