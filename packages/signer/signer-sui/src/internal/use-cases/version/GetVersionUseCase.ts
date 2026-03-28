import { inject, injectable } from "inversify";

import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { SuiAppBinder } from "@internal/app-binder/SuiAppBinder";

@injectable()
export class GetVersionUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: SuiAppBinder,
  ) {}

  execute(): GetVersionDAReturnType {
    return this.appBinder.getVersion();
  }
}
