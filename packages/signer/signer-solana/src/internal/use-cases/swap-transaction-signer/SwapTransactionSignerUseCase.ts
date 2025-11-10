import { inject, injectable } from "inversify";

import { SwapTransactionSignerDAReturnType } from "@api/app-binder/SwapTransactionSignerDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

@injectable()
export class SwapTransactionSignerUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: SolanaAppBinder,
  ) {}

  execute(
    derivationPath: string,
    serialisedTransaction: string,
    options?: {
      skipOpenApp?: boolean;
    },
  ): SwapTransactionSignerDAReturnType {
    return this.appBinder.SwapTransactionSigner({
      derivationPath,
      serialisedTransaction,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
