import { inject, injectable } from "inversify";

import { type RenameContactDAReturnType } from "@api/app-binder/RenameContactDeviceActionTypes";
import { type RenameContactInput } from "@api/model/RenameContact";
import { ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

/**
 * Delegates to `ContactsAppBinder`, which uses its injected `dmk` and
 * `sessionId` to construct and execute the `RenameContactDeviceAction`. The
 * injected `appName` is not used: rename is a dashboard operation served by the
 * device OS, not the embedded app.
 *
 * Caller-input validation is intentionally NOT done here: the public API returns
 * a device action, so validation lives inside the device action and surfaces as
 * a typed terminal error state on the observable rather than a synchronous throw.
 */
@injectable()
export class RenameContactUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder)
    private readonly appBinder: ContactsAppBinder,
  ) {}

  execute(input: RenameContactInput): RenameContactDAReturnType {
    return this.appBinder.renameContact(input);
  }
}
