import { type ConcordiumAccountOwnershipNetwork } from "@ledgerhq/context-module";
import { inject, injectable } from "inversify";

import { type VerifyAddressDAReturnType } from "@api/app-binder/VerifyAddressDeviceActionTypes";
import { type VerifyAddressOptions } from "@api/model/VerifyAddressOptions";
import { ConcordiumAppBinder } from "@internal/app-binder/ConcordiumAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class VerifyAddressUseCase {
  private readonly _appBinder: ConcordiumAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: ConcordiumAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    address: string,
    network: ConcordiumAccountOwnershipNetwork,
    options?: VerifyAddressOptions,
  ): VerifyAddressDAReturnType {
    return this._appBinder.verifyAddress({
      derivationPath,
      address,
      network,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
