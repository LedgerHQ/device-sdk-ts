import { inject, injectable } from "inversify";

import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SuiAppBinder } from "@internal/app-binder/SuiAppBinder";

@injectable()
export class SignTransactionUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: SuiAppBinder,
  ) {}

  execute(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this.appBinder.signTransaction({
      derivationPath,
      transaction,
      objectData: options?.objectData,
      descriptor: options?.descriptor,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
