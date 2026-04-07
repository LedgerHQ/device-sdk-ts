import { inject, injectable } from "inversify";

import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type PublicKeyOptions } from "@api/model/PublicKeyOptions";
import { ConcordiumAppBinder } from "@internal/app-binder/ConcordiumAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class GetPublicKeyUseCase {
  private readonly _appBinder: ConcordiumAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: ConcordiumAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    options?: PublicKeyOptions,
  ): GetPublicKeyDAReturnType {
    return this._appBinder.getPublicKey({
      derivationPath,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
