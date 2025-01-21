import { inject, injectable } from "inversify";

import { GetWalletAddressDAReturnType } from "@api/app-binder/GetWalletAddressDeviceActionTypes";
import { Wallet } from "@api/model/Wallet";
import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class GetWalletAddressUseCase {
  private _appBinder: BtcAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinder)
    appBinding: BtcAppBinder,
  ) {
    this._appBinder = appBinding;
  }

  execute(
    checkOnDevice: boolean,
    wallet: Wallet,
    change: boolean,
    addressIndex: number,
  ): GetWalletAddressDAReturnType {
    return this._appBinder.getWalletAddress({
      wallet,
      checkOnDevice,
      change,
      addressIndex,
    });
  }
}
