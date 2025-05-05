import { inject, injectable } from "inversify";

import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class SignMessageUseCase {
  private _appBinder: BtcAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinder)
    appBinding: BtcAppBinder,
  ) {
    this._appBinder = appBinding;
  }

  execute(
    derivationPath: string,
    message: string,
    skipOpenApp: boolean,
  ): SignMessageDAReturnType {
    // 1- Sign msg using the app binding
    return this._appBinder.signMessage({
      derivationPath,
      message,
      skipOpenApp,
    });
  }
}
