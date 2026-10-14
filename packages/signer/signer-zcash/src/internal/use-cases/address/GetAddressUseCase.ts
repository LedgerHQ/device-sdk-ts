import {
  type BtcLegacyAppBinder,
  btcLegacyTypes,
} from "@ledgerhq/signer-btc-legacy-core";
import { inject, injectable } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";

@injectable()
export class GetAddressUseCase {
  private readonly _appBinder: BtcLegacyAppBinder<ZcashErrorCodes>;

  constructor(
    // Provided by the legacy-protocol signer kit, bound to the Zcash profile.
    @inject(btcLegacyTypes.AppBinder)
    appBinder: BtcLegacyAppBinder<ZcashErrorCodes>,
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
