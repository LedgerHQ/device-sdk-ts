import { inject, injectable } from "inversify";

import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/SignerIcp";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { IcpAppBinder } from "@internal/app-binder/IcpAppBinder";

@injectable()
export class SignTransactionUseCase {
  private readonly _appBinder: IcpAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: IcpAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._appBinder.signTransaction({
      derivationPath,
      transaction,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
