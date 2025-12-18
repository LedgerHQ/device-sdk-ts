import { inject, injectable } from "inversify";

import { type WalletPolicy } from "@api/model/Wallet";
import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class RegisterWalletUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder)
    private readonly _appBinder: BtcAppBinder,
  ) {}

  execute(wallet: WalletPolicy, skipOpenApp: boolean) {
    return this._appBinder.registerWallet({
      wallet,
      skipOpenApp,
    });
  }
}
