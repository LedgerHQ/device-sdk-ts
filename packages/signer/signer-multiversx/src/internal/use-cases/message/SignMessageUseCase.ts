import { inject, injectable } from "inversify";

import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { MultiversxAppBinder } from "@internal/app-binder/MultiversxAppBinder";

@injectable()
export class SignMessageUseCase {
  private readonly _appBinder: MultiversxAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: MultiversxAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    message: string | Uint8Array,
  ): SignMessageDAReturnType {
    return this._appBinder.signMessage({
      derivationPath,
      message,
      skipOpenApp: false,
    });
  }
}
