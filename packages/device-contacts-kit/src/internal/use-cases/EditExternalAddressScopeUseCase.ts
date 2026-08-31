import { inject, injectable } from "inversify";

import { type EditExternalAddressScopeDAReturnType } from "@api/app-binder/EditExternalAddressScopeDeviceActionTypes";
import { type EditExternalAddressScopeInput } from "@api/model/EditExternalAddressScope";
import { ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

/**
 * Delegates to `ContactsAppBinder`, which constructs and executes the
 * `EditExternalAddressScopeDeviceAction`. Input validation lives in the device
 * action (surfaced as a typed error state), not here.
 */
@injectable()
export class EditExternalAddressScopeUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder)
    private readonly appBinder: ContactsAppBinder,
  ) {}

  execute(
    input: EditExternalAddressScopeInput,
  ): EditExternalAddressScopeDAReturnType {
    return this.appBinder.editExternalAddressScope(input);
  }
}
