import { type RenameContactInput } from "@api/model/RenameContact";
import {
  CONTACT_NAME_BUFFER_LENGTH,
  ContactsValidationError,
  GROUP_HANDLE_SIZE,
  HMAC_PROOF_LENGTH,
  validateByteLength,
  validatePrintableLabel,
} from "@internal/app-binder/model/contactsValidation";

/**
 * Validate the caller input for Rename Contact. Returns the first
 * `ContactsValidationError` found, or `null` when the input is valid.
 *
 * Non-throwing by design: the device action calls this so an invalid input is
 * surfaced as a typed terminal error state on the observable, keeping the public
 * `ContactsManager.renameContact` free of synchronous throws.
 */
export function validateRenameContactInput(
  input: RenameContactInput,
): ContactsValidationError | null {
  try {
    validatePrintableLabel(input.newContactName, {
      field: "newContactName",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validatePrintableLabel(input.previousContactName, {
      field: "previousContactName",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validateByteLength(input.groupHandle, {
      field: "groupHandle",
      expectedBytes: GROUP_HANDLE_SIZE,
    });
    validateByteLength(input.hmacProof, {
      field: "hmacProof",
      expectedBytes: HMAC_PROOF_LENGTH,
    });

    return null;
  } catch (error) {
    if (error instanceof ContactsValidationError) {
      return error;
    }
    throw error;
  }
}
