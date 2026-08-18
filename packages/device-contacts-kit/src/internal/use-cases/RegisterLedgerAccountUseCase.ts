import { inject, injectable } from "inversify";

import { type RegisterLedgerAccountDAReturnType } from "@api/app-binder/RegisterLedgerAccountDeviceActionTypes";
import { type RegisterLedgerAccountInput } from "@api/model/RegisterLedgerAccount";
import { ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

/**
 * Delegates to `ContactsAppBinder`, which uses its injected `dmk`, `sessionId`,
 * and `appName` to construct and execute the `RegisterLedgerAccountDeviceAction`.
 *
 * Caller-input validation is intentionally NOT done here: the public API returns
 * a device action, so validation lives inside the device action and surfaces as
 * a typed terminal error state on the observable rather than a synchronous throw.
 */
@injectable()
export class RegisterLedgerAccountUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder)
    private readonly appBinder: ContactsAppBinder,
  ) {}

  execute(
    input: RegisterLedgerAccountInput,
  ): RegisterLedgerAccountDAReturnType {
    return this.appBinder.registerLedgerAccount(input);
  }
}
