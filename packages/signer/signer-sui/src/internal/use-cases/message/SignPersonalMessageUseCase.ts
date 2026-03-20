import { inject, injectable } from "inversify";

import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type MessageOptions } from "@api/model/MessageOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SuiAppBinder } from "@internal/app-binder/SuiAppBinder";

@injectable()
export class SignPersonalMessageUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: SuiAppBinder,
  ) {}

  execute(
    derivationPath: string,
    message: Uint8Array,
    options?: MessageOptions,
  ): SignPersonalMessageDAReturnType {
    return this.appBinder.signPersonalMessage({
      derivationPath,
      message,
      skipOpenApp: options?.skipOpenApp ?? false,
    });
  }
}
