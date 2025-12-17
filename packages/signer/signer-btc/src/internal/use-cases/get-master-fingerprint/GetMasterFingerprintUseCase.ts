import { inject, injectable } from "inversify";

import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class GetMasterFingerprintUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder)
    private readonly _appBinder: BtcAppBinder,
  ) {}

  execute(options: { skipOpenApp: boolean }) {
    return this._appBinder.getMasterFingerprint({
      skipOpenApp: options.skipOpenApp,
    });
  }
}
