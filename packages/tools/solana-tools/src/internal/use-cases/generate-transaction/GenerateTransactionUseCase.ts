import { inject, injectable } from "inversify";

import { type GenerateTransactionDAReturnType } from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { type SolanaToolsAppBinder } from "@internal/app-binder/SolanaToolsAppBinder";

@injectable()
export class GenerateTransactionUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder)
    private appBinder: SolanaToolsAppBinder,
  ) {}

  execute(
    derivationPath: string,
    skipOpenApp: boolean,
  ): GenerateTransactionDAReturnType {
    return this.appBinder.generateTransaction({
      derivationPath,
      skipOpenApp,
    });
  }
}
