import { inject, injectable } from "inversify";

import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { NearAppBinder } from "@internal/app-binder/NearAppBinder";

@injectable()
export class SignMessageUseCase {
  private readonly _appBinder: NearAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: NearAppBinder,
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
