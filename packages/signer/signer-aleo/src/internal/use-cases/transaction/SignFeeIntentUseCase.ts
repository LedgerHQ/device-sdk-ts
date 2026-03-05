import { inject, injectable } from "inversify";

import { type SignFeeIntentDAReturnType } from "@api/app-binder/SignFeeIntentDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { AleoAppBinder } from "@internal/app-binder/AleoAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class SignFeeIntentUseCase {
  private readonly _appBinder: AleoAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: AleoAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    feeIntent: Uint8Array,
    options?: TransactionOptions,
  ): SignFeeIntentDAReturnType {
    return this._appBinder.signFeeIntent({
      feeIntent,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
