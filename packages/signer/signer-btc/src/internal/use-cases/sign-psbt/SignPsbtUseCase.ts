import { inject, injectable } from "inversify";

import { SignPsbtDAReturnType } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { Psbt } from "@api/model/Psbt";
import { Wallet } from "@api/model/Wallet";
import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class SignPsbtUseCase {
  private _appBinder: BtcAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinder)
    appBinding: BtcAppBinder,
  ) {
    this._appBinder = appBinding;
  }

  execute(
    wallet: Wallet,
    psbt: Psbt,
    skipOpenApp: boolean,
  ): SignPsbtDAReturnType {
    return this._appBinder.signPsbt({
      wallet,
      psbt,
      skipOpenApp,
    });
  }
}
