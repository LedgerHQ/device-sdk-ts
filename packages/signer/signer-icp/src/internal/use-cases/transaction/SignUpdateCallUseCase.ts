import { inject, injectable } from "inversify";

import { type SignUpdateCallDAReturnType } from "@api/app-binder/SignUpdateCallDeviceActionTypes";
import { type CommonOptions } from "@api/SignerIcp";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { IcpAppBinder } from "@internal/app-binder/IcpAppBinder";

@injectable()
export class SignUpdateCallUseCase {
  private readonly _appBinder: IcpAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: IcpAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    callRequest: Uint8Array,
    readStateRequest: Uint8Array,
    options?: CommonOptions,
  ): SignUpdateCallDAReturnType {
    return this._appBinder.signUpdateCall({
      derivationPath,
      callRequest,
      readStateRequest,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
