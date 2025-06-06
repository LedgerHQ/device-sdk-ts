import { inject, injectable } from "inversify";

import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
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
    options?: {
      skipOpenApp?: boolean;
    },
  ): SignTransactionDAReturnType {
    return this.appBinder.signTransaction({
      derivationPath,
      transaction,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
