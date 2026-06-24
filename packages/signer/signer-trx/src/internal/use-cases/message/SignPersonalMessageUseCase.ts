import { inject, injectable } from "inversify";

import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type MessageOptions } from "@api/model/MessageOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { TronAppBinder } from "@internal/app-binder/TronAppBinder";

@injectable()
export class SignPersonalMessageUseCase {
  private readonly _appBinder: TronAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: TronAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ): SignPersonalMessageDAReturnType {
    const messageBytes =
      typeof message === "string" ? new TextEncoder().encode(message) : message;

    return this._appBinder.signPersonalMessage({
      derivationPath,
      message: messageBytes,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
