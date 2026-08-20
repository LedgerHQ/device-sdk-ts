import { inject, injectable } from "inversify";

import { type RenameContactDAReturnType } from "@api/contacts/app-binder/RenameContactDeviceActionTypes";
import { type RenameContactArgs } from "@api/contacts/model/RenameContactArgs";
import {
  CONTACT_NAME_BUFFER_LENGTH,
  validateDerivationPath,
  validatePrintableLabel,
} from "@api/contacts/validation";
import { ContactsAppBinder } from "@internal/contacts/app-binder/ContactsAppBinder";
import { contactsTypes } from "@internal/contacts/di/contactsTypes";

@injectable()
export class RenameContactUseCase {
  private _appBinder: ContactsAppBinder;

  constructor(
    @inject(contactsTypes.ContactsAppBinder) appBinder: ContactsAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(args: RenameContactArgs): RenameContactDAReturnType {
    validatePrintableLabel(args.newName, {
      field: "newName",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validatePrintableLabel(args.oldName, {
      field: "oldName",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validateDerivationPath(args.derivationPath);

    return this._appBinder.renameContact({
      ...args,
      derivationPath: stripMPrefix(args.derivationPath),
    });
  }
}

// Mirrors signer-eth's normalization: `validateDerivationPath` accepts both
// "m/…" and bare-segment forms, but the downstream path-packer expects the
// bare-segment form.
function stripMPrefix(path: string): string {
  if (path.startsWith("m/") || path.startsWith("M/")) {
    return path.slice(2);
  }
  return path;
}
