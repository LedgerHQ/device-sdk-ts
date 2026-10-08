import { type EditExternalAddressScopeInput } from "@api/model/EditExternalAddressScope";
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

// The address-level proof (`hmac_rest`) shares the 32-byte HMAC width.
const HMAC_REST_LENGTH = HMAC_PROOF_LENGTH;

/**
 * Validate the caller input for Edit External Address Scope. Returns the first
 * `ContactsValidationError`, or `null` when valid. Non-throwing so the device
 * action can surface it as a typed terminal error state.
 */
export function validateEditExternalAddressScopeInput(
  input: EditExternalAddressScopeInput,
): ContactsValidationError | null {
  try {
    validatePrintableLabel(input.contactName, {
      field: "contactName",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validatePrintableLabel(input.previousScope, {
      field: "previousScope",
      bufferLength: SCOPE_BUFFER_LENGTH,
    });
    validatePrintableLabel(input.newScope, {
      field: "newScope",
      bufferLength: SCOPE_BUFFER_LENGTH,
    });

    validateFamilyIdentifiers({
      blockchainFamily: input.blockchainFamily,
      identifiers: [{ field: "identifier", value: input.identifier }],
      chainId: input.chainId,
    });

    validateByteLength(input.groupHandle, {
      field: "groupHandle",
      expectedBytes: GROUP_HANDLE_SIZE,
    });
    validateByteLength(input.hmacProof, {
      field: "hmacProof",
      expectedBytes: HMAC_PROOF_LENGTH,
    });
    validateByteLength(input.hmacRest, {
      field: "hmacRest",
      expectedBytes: HMAC_REST_LENGTH,
    });

    return null;
  } catch (error) {
    if (error instanceof ContactsValidationError) {
      return error;
    }
    throw error;
  }
}
