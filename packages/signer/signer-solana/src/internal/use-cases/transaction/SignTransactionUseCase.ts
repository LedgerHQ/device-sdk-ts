import { inject, injectable } from "inversify";

import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Transaction } from "@api/model/Transaction";
import { TransactionResolutionContext } from "@api/model/TransactionResolutionContext";
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
    resolutionContext?: TransactionResolutionContext,
    options?: {
      skipOpenApp?: boolean;
    },
  ): SignTransactionDAReturnType {
    return this.appBinder.signTransaction({
      derivationPath,
      transaction,
      resolutionContext: resolutionContext,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
