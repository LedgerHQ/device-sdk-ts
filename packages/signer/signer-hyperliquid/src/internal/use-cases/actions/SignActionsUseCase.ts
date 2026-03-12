import { inject, injectable } from "inversify";

import { type SignActionsDAReturnType } from "@api/app-binder/SignActionsDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { HyperliquidAppBinder } from "@internal/app-binder/HyperliquidAppBinder";

type SignActionsParams = Parameters<HyperliquidAppBinder["signActions"]>[0];

@injectable()
export class SignActionsUseCase {
  private readonly _appBinder: HyperliquidAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: HyperliquidAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(params: SignActionsParams): SignActionsDAReturnType {
    return this._appBinder.signActions(params);
  }
}
