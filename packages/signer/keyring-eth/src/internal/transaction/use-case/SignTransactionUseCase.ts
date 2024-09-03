import { inject, injectable } from "inversify";

import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Transaction } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class SignTransactionUseCase {
  private _appBinding: EthAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding)
    appBinding: EthAppBinder,
  ) {
    this._appBinding = appBinding;
  }

  execute(
    derivationPath: string,
    transaction: Transaction,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._appBinding.signTransaction({
      derivationPath,
      transaction,
      options,
    });
  }
}
