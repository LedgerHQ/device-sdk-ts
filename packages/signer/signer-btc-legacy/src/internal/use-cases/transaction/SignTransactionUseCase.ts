import { inject, injectable } from "inversify";

import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";

@injectable()
export class SignTransactionUseCase<ErrorCodes extends string> {
  private readonly _appBinder: BtcLegacyAppBinder<ErrorCodes>;

  constructor(
    @inject(btcLegacyTypes.AppBinder)
    appBinder: BtcLegacyAppBinder<ErrorCodes>,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    transaction: LegacyCreateTransactionArg,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType<ErrorCodes> {
    return this._appBinder.signTransaction({
      transaction,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
