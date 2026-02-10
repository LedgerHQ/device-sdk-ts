import { inject, injectable } from "inversify";

import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { AleoAppBinder } from "@internal/app-binder/AleoAppBinder";

@injectable()
export class SignMessageUseCase {
  private readonly _appBinder: AleoAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: AleoAppBinder,
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
