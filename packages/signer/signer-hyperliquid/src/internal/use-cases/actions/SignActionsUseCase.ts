import { inject, injectable } from "inversify";

import { type SignActionsDAReturnType } from "@api/app-binder/SignActionsDeviceActionTypes";
import { type ActionsOptions } from "@api/model/ActionsOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { HyperliquidAppBinder } from "@internal/app-binder/HyperliquidAppBinder";

@injectable()
export class SignActionsUseCase {
  private readonly _appBinder: HyperliquidAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: HyperliquidAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    Actions: Uint8Array,
    options?: ActionsOptions,
  ): SignActionsDAReturnType {
    return this._appBinder.signActions({
      derivationPath,
      Actions,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
