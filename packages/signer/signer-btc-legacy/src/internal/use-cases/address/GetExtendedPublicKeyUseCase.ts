import { inject, injectable } from "inversify";

import { type GetExtendedPublicKeyDAReturnType } from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { type ExtendedPublicKeyOptions } from "@api/model/ExtendedPublicKeyOptions";
import { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";

@injectable()
export class GetExtendedPublicKeyUseCase<ErrorCodes extends string> {
  private readonly _appBinder: BtcLegacyAppBinder<ErrorCodes>;

  constructor(
    @inject(btcLegacyTypes.AppBinder)
    appBinder: BtcLegacyAppBinder<ErrorCodes>,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    options?: ExtendedPublicKeyOptions,
  ): GetExtendedPublicKeyDAReturnType<ErrorCodes> {
    return this._appBinder.getExtendedPublicKey({
      derivationPath,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
