import { inject, injectable } from "inversify";

import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

@injectable()
export class SignMessageUseCase {
  private readonly _appBinder: HederaAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: HederaAppBinder,
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
