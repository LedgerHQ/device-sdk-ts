import { inject, injectable } from "inversify";

import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { StellarAppBinder } from "@internal/app-binder/StellarAppBinder";

@injectable()
export class SignTransactionUseCase {
  private readonly _appBinder: StellarAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: StellarAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._appBinder.signTransaction({
      derivationPath,
      transaction,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
