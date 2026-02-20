import { inject, injectable } from "inversify";

import { CraftTransactionDAReturnType } from "@api/app-binder/CraftTransactionDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

@injectable()
export class CraftTransactionUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: SolanaAppBinder,
  ) {}

  execute(
    derivationPath: string,
    serialisedTransaction: string,
    options?: {
      skipOpenApp?: boolean;
    },
  ): CraftTransactionDAReturnType {
    return this.appBinder.craftTransaction({
      derivationPath,
      serialisedTransaction,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
