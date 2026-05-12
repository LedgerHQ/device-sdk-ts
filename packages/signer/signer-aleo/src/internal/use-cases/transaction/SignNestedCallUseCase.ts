import { inject, injectable } from "inversify";

import { type SignNestedCallDAReturnType } from "@api/app-binder/SignNestedCallDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { AleoAppBinder } from "@internal/app-binder/AleoAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class SignNestedCallUseCase {
  private readonly _appBinder: AleoAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: AleoAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    nestedCallRequest: Uint8Array,
    options?: TransactionOptions,
  ): SignNestedCallDAReturnType {
    return this._appBinder.signNestedCall({
      nestedCallRequest,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
