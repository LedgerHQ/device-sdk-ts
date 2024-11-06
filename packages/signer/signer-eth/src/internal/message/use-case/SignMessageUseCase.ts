import { inject, injectable } from "inversify";

import { SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class SignMessageUseCase {
  private _appBinding: EthAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding)
    appBinding: EthAppBinder,
  ) {
    this._appBinding = appBinding;
  }

  execute(
    derivationPath: string,
    message: string | Uint8Array,
  ): SignPersonalMessageDAReturnType {
    // 1- Sign the transaction using the app binding
    return this._appBinding.signPersonalMessage({
      derivationPath,
      message,
    });
  }
}
