import { inject, injectable } from "inversify";

import { type EditExternalAddressLabelDAReturnType } from "@api/contacts/app-binder/EditExternalAddressLabelDeviceActionTypes";
import { type EditExternalAddressLabelArgs } from "@api/contacts/model/EditExternalAddressLabelArgs";
import {
  CONTACT_NAME_BUFFER_LENGTH,
  GROUP_HANDLE_SIZE,
  HMAC_PROOF_LENGTH,
  SCOPE_BUFFER_LENGTH,
  validateAddressHex,
  validateChainId,
  validateDerivationPath,
  validatePrintableLabel,
  ValidationError,
} from "@api/contacts/validation";
import { ContactsAppBinder } from "@internal/contacts/app-binder/ContactsAppBinder";
import { contactsTypes } from "@internal/contacts/di/contactsTypes";

@injectable()
export class EditExternalAddressLabelUseCase {
  private _appBinder: ContactsAppBinder;

  constructor(
    @inject(contactsTypes.ContactsAppBinder) appBinder: ContactsAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    args: EditExternalAddressLabelArgs,
  ): EditExternalAddressLabelDAReturnType {
    validatePrintableLabel(args.contactName, {
      field: "contactName",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validatePrintableLabel(args.newLabel, {
      field: "newLabel",
      bufferLength: SCOPE_BUFFER_LENGTH,
    });
    validatePrintableLabel(args.oldLabel, {
      field: "oldLabel",
      bufferLength: SCOPE_BUFFER_LENGTH,
    });
    validateAddressHex(args.addressHex);
    validateChainId(args.chainId);
    validateDerivationPath(args.derivationPath);
    assertHexByteLength(
      args.groupHandleHex,
      GROUP_HANDLE_SIZE,
      "groupHandleHex",
    );
    assertHexByteLength(args.hmacProofHex, HMAC_PROOF_LENGTH, "hmacProofHex");
    assertHexByteLength(args.hmacRestHex, HMAC_PROOF_LENGTH, "hmacRestHex");

    return this._appBinder.editExternalAddressLabel({
      ...args,
      derivationPath: stripMPrefix(args.derivationPath),
    });
  }
}

function stripMPrefix(path: string): string {
  if (path.startsWith("m/") || path.startsWith("M/")) {
    return path.slice(2);
  }
  return path;
}

function assertHexByteLength(
  hex: string,
  expectedBytes: number,
  field: string,
): void {
  const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (raw.length !== expectedBytes * 2) {
    throw new ValidationError(
      `${field} must be ${expectedBytes} bytes (${expectedBytes * 2} hex chars), got ${raw.length} hex chars`,
    );
  }
  if (!/^[0-9a-fA-F]*$/.test(raw)) {
    throw new ValidationError(`${field} contains non-hex characters`);
  }
}
