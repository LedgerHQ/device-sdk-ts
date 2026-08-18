import { inject, injectable } from "inversify";

import { type GetECDHSecretDAReturnType } from "@api/app-binder/GetECDHSecretDeviceActionTypes";
import { type EcdhOptions } from "@api/model/EcdhOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TronAppBinder } from "@internal/app-binder/TronAppBinder";

@injectable()
export class GetECDHSecretUseCase {
  private readonly _appBinder: TronAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: TronAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    publicKey: Uint8Array,
    options?: EcdhOptions,
  ): GetECDHSecretDAReturnType {
    return this._appBinder.getECDHSecret({
      derivationPath,
      publicKey,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
