import { inject, injectable } from "inversify";

import { type CraftTransactionDAReturnType } from "@api/app-binder/CraftTransactionDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { type SolanaToolsAppBinder } from "@internal/app-binder/SolanaToolsAppBinder";

@injectable()
export class CraftTransactionUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder)
    private appBinder: SolanaToolsAppBinder,
  ) {}

  execute(args: {
    derivationPath: string;
    serialisedTransaction?: string;
    transactionSignature?: string;
    rpcUrl?: string;
    skipOpenApp?: boolean;
  }): CraftTransactionDAReturnType {
    return this.appBinder.craftTransaction(args);
  }
}
