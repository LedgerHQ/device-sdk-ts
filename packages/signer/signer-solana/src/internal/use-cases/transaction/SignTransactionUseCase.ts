import { inject, injectable } from "inversify";

import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { SolanaTransactionOptionalConfig } from "@api/model/SolanaTransactionOptionalConfig";
import { Transaction } from "@api/model/Transaction";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

@injectable()
export class SignTransactionUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: SolanaAppBinder,
  ) {}

  execute(
    derivationPath: string,
    transaction: Transaction,
    solanaTransactionOptionalConfig?: SolanaTransactionOptionalConfig,
  ): SignTransactionDAReturnType {
    return this.appBinder.signTransaction({
      derivationPath,
      transaction,
      solanaTransactionOptionalConfig,
    });
  }
}
