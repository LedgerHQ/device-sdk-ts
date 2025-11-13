import { inject, injectable } from "inversify";

import { VerifySafeAddressDAReturnType } from "@api/app-binder/VerifySafeAddressDeviceActionTypes";
import { SafeAddressOptions } from "@api/model/SafeAddressOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class VerifySafeAddressUseCase {
  private _appBinder: EthAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: EthAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    safeContractAddress: string,
    options?: SafeAddressOptions,
  ): VerifySafeAddressDAReturnType {
    return this._appBinder.verifySafeAddress({ safeContractAddress, options });
  }
}
