import { inject, injectable } from "inversify";

import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { TransactionOptions } from "@api/SignerCosmos";
import { CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class SignTransactionUseCase {
  private readonly _appBinder: CosmosAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: CosmosAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    hrp: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._appBinder.signTransaction({
      derivationPath,
      transaction,
      hrp,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
