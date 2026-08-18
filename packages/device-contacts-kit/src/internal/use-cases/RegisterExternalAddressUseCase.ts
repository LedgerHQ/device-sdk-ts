import { inject, injectable } from "inversify";

import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

/**
 * Delegates to `ContactsAppBinder`, which uses its injected `dmk`, `sessionId`,
 * and `appName` to construct and execute the `RegisterExternalAddressDeviceAction`.
 *
 * Caller-input validation is intentionally NOT done here: the public API returns
 * a device action, so validation lives inside the device action and surfaces as
 * a typed terminal error state on the observable rather than a synchronous throw.
 */
@injectable()
export class RegisterExternalAddressUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder)
    private readonly appBinder: ContactsAppBinder,
  ) {}

  execute(
    input: RegisterExternalAddressInput,
  ): RegisterExternalAddressDAReturnType {
    return this.appBinder.registerExternalAddress(input);
  }
}
