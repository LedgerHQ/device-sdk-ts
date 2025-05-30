import { inject, injectable } from "inversify";

import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type MessageOptions } from "@api/model/MessageOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { type SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

@injectable()
export class SignMessageUseCase {
  private _appBinder: SolanaAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinder)
    appBinding: SolanaAppBinder,
  ) {
    this._appBinder = appBinding;
  }

  execute(
    derivationPath: string,
    message: string,
    options?: MessageOptions,
  ): SignMessageDAReturnType {
    return this._appBinder.signMessage({
      derivationPath,
      message,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
