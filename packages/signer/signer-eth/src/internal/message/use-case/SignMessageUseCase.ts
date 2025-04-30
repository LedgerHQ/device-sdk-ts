import { inject, injectable } from "inversify";

import { SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { MessageOptions } from "@api/model/MessageOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class SignMessageUseCase {
  private _appBinder: EthAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding)
    appBinding: EthAppBinder,
  ) {
    this._appBinder = appBinding;
  }

  execute(
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ): SignPersonalMessageDAReturnType {
    // 1- Sign the transaction using the app binding
    return this._appBinder.signPersonalMessage({
      derivationPath,
      message,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
