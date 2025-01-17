import { inject, injectable } from "inversify";

import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Psbt } from "@api/model/Psbt";
import { Wallet } from "@api/model/Wallet";
import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class SignTransactionUseCase {
  private _appBinder: BtcAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinder)
    appBinding: BtcAppBinder,
  ) {
    this._appBinder = appBinding;
  }

  execute(wallet: Wallet, psbt: Psbt): SignTransactionDAReturnType {
    return this._appBinder.signTransaction({
      wallet,
      psbt,
    });
  }
}
