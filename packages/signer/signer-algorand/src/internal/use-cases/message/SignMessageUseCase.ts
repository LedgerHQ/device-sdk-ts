import { inject, injectable } from "inversify";

import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { AlgorandAppBinder } from "@internal/app-binder/AlgorandAppBinder";

@injectable()
export class SignMessageUseCase {
  private readonly _appBinder: AlgorandAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: AlgorandAppBinder,
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
