import { inject, injectable } from "inversify";

import { GenerateTransactionDAReturnType } from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

@injectable()
export class GenerateTransactionUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: SolanaAppBinder,
  ) {}

  execute(
    derivationPath: string,
    options?: {
      skipOpenApp?: boolean;
    },
  ): GenerateTransactionDAReturnType {
    return this.appBinder.generateTransaction({
      derivationPath,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
