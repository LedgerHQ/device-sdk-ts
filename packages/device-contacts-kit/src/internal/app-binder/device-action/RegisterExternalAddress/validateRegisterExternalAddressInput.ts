import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import {
  CONTACT_NAME_BUFFER_LENGTH,
  ContactsValidationError,
  GROUP_HANDLE_SIZE,
  HMAC_PROOF_LENGTH,
  SCOPE_BUFFER_LENGTH,
  validateByteLength,
  validateFamilyIdentifiers,
  validatePrintableLabel,
} from "@internal/app-binder/model/contactsValidation";

/**
 * Validate the caller input for Register External Address. Returns the first
 * `ContactsValidationError` found, or `null` when the input is valid.
 *
 * Non-throwing by design: the device action calls this so an invalid input is
 * surfaced as a typed terminal error state on the observable, keeping the
 * public `ContactsManager.registerExternalAddress` free of synchronous throws.
 */
export function validateRegisterExternalAddressInput(
  input: RegisterExternalAddressInput,
): ContactsValidationError | null {
  try {
    validatePrintableLabel(input.contactName, {
      field: "contactName",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validatePrintableLabel(input.scope, {
      field: "scope",
      bufferLength: SCOPE_BUFFER_LENGTH,
    });

    validateFamilyIdentifiers({
      blockchainFamily: input.blockchainFamily,
      identifiers: [{ field: "identifier", value: input.identifier }],
      chainId: input.chainId,
    });

    if (input.existingContactGroup) {
      validateByteLength(input.existingContactGroup.groupHandle, {
        field: "existingContactGroup.groupHandle",
        expectedBytes: GROUP_HANDLE_SIZE,
      });
      validateByteLength(input.existingContactGroup.hmacProof, {
        field: "existingContactGroup.hmacProof",
        expectedBytes: HMAC_PROOF_LENGTH,
      });
    }

    return null;
  } catch (error) {
    if (error instanceof ContactsValidationError) {
      return error;
    }
    throw error;
  }
}
