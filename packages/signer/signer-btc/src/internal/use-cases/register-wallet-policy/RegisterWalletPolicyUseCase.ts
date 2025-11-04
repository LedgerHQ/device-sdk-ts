import { inject, injectable } from "inversify";

import { RegisterWalletPolicyDAReturnType } from "@api/app-binder/RegisterWalletPolicyTypes";
import { WalletPolicy } from "@api/model/Wallet";
import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class RegisterWalletPolicyUseCase {
  private _appBinder: BtcAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinder)
    appBinding: BtcAppBinder,
  ) {
    this._appBinder = appBinding;
  }

  execute(
    walletPolicy: WalletPolicy,
    skipOpenApp: boolean,
  ): RegisterWalletPolicyDAReturnType {
    return this._appBinder.registerWalletPolicy({
      walletPolicy,
      skipOpenApp,
    });
  }
}
