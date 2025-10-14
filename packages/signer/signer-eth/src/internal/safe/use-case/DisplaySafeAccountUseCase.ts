import { inject, injectable } from "inversify";

import { DisplaySafeAccountDAReturnType } from "@api/app-binder/DisplaySafeAccountDeviceActionTypes";
import { SafeAccountOptions } from "@api/model/SafeAccountOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class DisplaySafeAccountUseCase {
  private _appBinder: EthAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: EthAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    safeContractAddress: string,
    options?: SafeAccountOptions,
  ): DisplaySafeAccountDAReturnType {
    return this._appBinder.displaySafeAccount({ safeContractAddress, options });
  }
}
