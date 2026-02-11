import { inject, injectable } from "inversify";

import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TezosAppBinder } from "@internal/app-binder/TezosAppBinder";

@injectable()
export class SignMessageUseCase {
  private readonly _appBinder: TezosAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: TezosAppBinder,
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
