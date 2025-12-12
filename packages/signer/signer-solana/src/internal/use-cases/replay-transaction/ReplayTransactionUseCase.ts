import { inject, injectable } from "inversify";

import { ReplayTransactionDAReturnType } from "@api/app-binder/ReplayTransactionDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

@injectable()
export class ReplayTransactionUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: SolanaAppBinder,
  ) {}

  execute(
    derivationPath: string,
    serialisedTransaction: string,
    options?: {
      skipOpenApp?: boolean;
    },
  ): ReplayTransactionDAReturnType {
    return this.appBinder.replayTransaction({
      derivationPath,
      serialisedTransaction,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
