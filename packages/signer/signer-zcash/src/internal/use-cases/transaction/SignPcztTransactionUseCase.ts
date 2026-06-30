import { inject, injectable } from "inversify";

import { type SignPcztTransactionDAReturnType } from "@api/app-binder/SignPcztTransactionDeviceActionTypes";
import { type PcztTransaction } from "@api/model/PcztTransaction";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

@injectable()
export class SignPcztTransactionUseCase {
  private readonly _appBinder: ZcashAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: ZcashAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    transaction: PcztTransaction,
    options?: TransactionOptions,
  ): SignPcztTransactionDAReturnType {
    return this._appBinder.signPcztTransaction({
      transaction,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
