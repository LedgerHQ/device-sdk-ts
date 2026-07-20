import { inject, injectable } from "inversify";

import { type SignTransactionHashDAReturnType } from "@api/app-binder/SignTransactionHashDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TronAppBinder } from "@internal/app-binder/TronAppBinder";

@injectable()
export class SignTransactionHashUseCase {
  private readonly _appBinder: TronAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: TronAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    transactionHash: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionHashDAReturnType {
    return this._appBinder.signTransactionHash({
      derivationPath,
      transactionHash,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
