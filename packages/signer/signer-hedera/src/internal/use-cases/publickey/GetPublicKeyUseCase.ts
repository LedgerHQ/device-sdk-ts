import { inject, injectable } from "inversify";

import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type PublicKeyOptions } from "@api/model/PublicKeyOptions";
import { assertValidKeyIndex } from "@internal/app-binder/command/utils/apduUtils";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

@injectable()
export class GetPublicKeyUseCase {
  private readonly _appBinder: HederaAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: HederaAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    keyIndex: number,
    options?: PublicKeyOptions,
  ): GetPublicKeyDAReturnType {
    assertValidKeyIndex(keyIndex);
    return this._appBinder.getPublicKey({
      keyIndex,
      checkOnDevice: options?.checkOnDevice ?? false,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
