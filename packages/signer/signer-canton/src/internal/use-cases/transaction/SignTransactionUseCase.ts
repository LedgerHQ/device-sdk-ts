import { inject, injectable } from "inversify";

import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { CantonAppBinder } from "@internal/app-binder/CantonAppBinder";

@injectable()
export class SignTransactionUseCase {
  private readonly _appBinder: CantonAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: CantonAppBinder,
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
