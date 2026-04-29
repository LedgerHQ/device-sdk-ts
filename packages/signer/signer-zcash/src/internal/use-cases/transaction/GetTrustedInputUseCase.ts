import { inject, injectable } from "inversify";

import { type GetTrustedInputDAReturnType } from "@api/app-binder/GetTrustedInputActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

@injectable()
export class GetTrustedInputUseCase {
  private readonly _appBinder: ZcashAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: ZcashAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    transaction: Uint8Array,
    options?: { indexLookup?: number; skipOpenApp?: boolean },
  ): GetTrustedInputDAReturnType {
    return this._appBinder.getTrustedInput({
      transaction,
      indexLookup: options?.indexLookup,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
