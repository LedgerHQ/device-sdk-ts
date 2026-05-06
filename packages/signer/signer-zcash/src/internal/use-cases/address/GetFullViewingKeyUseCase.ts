import { inject, injectable } from "inversify";

import { type GetFullViewingKeyDAReturnType } from "@api/app-binder/GetFullViewingKeyDeviceActionTypes";
import { type FullViewingKeyOptions } from "@api/model/FullViewingKeyOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

@injectable()
export class GetFullViewingKeyUseCase {
  private readonly _appBinder: ZcashAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: ZcashAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    options?: FullViewingKeyOptions,
  ): GetFullViewingKeyDAReturnType {
    return this._appBinder.getFullViewingKey({
      derivationPath,
      mode: options?.mode ?? "ufvk",
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
