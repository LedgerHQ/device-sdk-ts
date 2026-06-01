import { inject, injectable } from "inversify";

import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { PolkadotAppBinder } from "@internal/app-binder/PolkadotAppBinder";

@injectable()
export class SignTransactionUseCase {
  private readonly _appBinder: PolkadotAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: PolkadotAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    blob: Uint8Array,
    metadata: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._appBinder.signTransaction({
      derivationPath,
      blob,
      metadata,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
