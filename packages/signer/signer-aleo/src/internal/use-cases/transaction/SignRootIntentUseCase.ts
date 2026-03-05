import { inject, injectable } from "inversify";

import { type SignRootIntentDAReturnType } from "@api/app-binder/SignRootIntentDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { AleoAppBinder } from "@internal/app-binder/AleoAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class SignRootIntentUseCase {
  private readonly _appBinder: AleoAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: AleoAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    rootIntent: Uint8Array,
    options?: TransactionOptions,
  ): SignRootIntentDAReturnType {
    return this._appBinder.signRootIntent({
      derivationPath,
      rootIntent,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
