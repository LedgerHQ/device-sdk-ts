import { inject, injectable } from "inversify";

import { type EditExternalAddressIdentifierDAReturnType } from "@api/app-binder/EditExternalAddressIdentifierDeviceActionTypes";
import { type EditExternalAddressIdentifierInput } from "@api/model/EditExternalAddressIdentifier";
import { ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

/**
 * Delegates to `ContactsAppBinder`, which constructs and executes the
 * `EditExternalAddressIdentifierDeviceAction`. Input validation lives in the
 * device action (surfaced as a typed error state), not here.
 */
@injectable()
export class EditExternalAddressIdentifierUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder)
    private readonly appBinder: ContactsAppBinder,
  ) {}

  execute(
    input: EditExternalAddressIdentifierInput,
  ): EditExternalAddressIdentifierDAReturnType {
    return this.appBinder.editExternalAddressIdentifier(input);
  }
}
