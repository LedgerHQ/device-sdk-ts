import { type EditExternalAddressIdentifierInput } from "@api/model/EditExternalAddressIdentifier";
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
 * Validate the caller input for Edit External Address Identifier. Returns the
 * first `ContactsValidationError`, or `null` when valid. Non-throwing so the
 * device action can surface it as a typed terminal error state.
 */
export function validateEditExternalAddressIdentifierInput(
  input: EditExternalAddressIdentifierInput,
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
      identifiers: [
        { field: "previousIdentifier", value: input.previousIdentifier },
        { field: "newIdentifier", value: input.newIdentifier },
      ],
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
