import { inject, injectable } from "inversify";

import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { StellarAppBinder } from "@internal/app-binder/StellarAppBinder";

@injectable()
export class SignMessageUseCase {
  private readonly _appBinder: StellarAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: StellarAppBinder,
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
