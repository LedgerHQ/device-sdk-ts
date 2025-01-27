import { inject, injectable } from "inversify";

import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class GetExtendedPublicKeyUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder)
    private readonly _appBinder: BtcAppBinder,
  ) {}

  execute(derivationPath: string, options: { checkOnDevice: boolean }) {
    return this._appBinder.getExtendedPublicKey({
      derivationPath,
      checkOnDevice: options.checkOnDevice,
    });
  }
}
