import { type EditExternalAddressIdentifierInput } from "@api/model/EditExternalAddressIdentifier";
import { BLOCKCHAIN_FAMILY_BY_NAME } from "@internal/app-binder/model/contactsConstants";
import {
  CONTACT_NAME_BUFFER_LENGTH,
  ContactsValidationError,
  ETH_ADDRESS_BYTES,
  GROUP_HANDLE_SIZE,
  HMAC_PROOF_LENGTH,
  SCOPE_BUFFER_LENGTH,
  validateByteLength,
  validateChainId,
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

    const family = input.blockchainFamily.toLowerCase();
    if (!(family in BLOCKCHAIN_FAMILY_BY_NAME)) {
      throw new ContactsValidationError(
        `Unsupported blockchain family: ${input.blockchainFamily}`,
      );
    }
    if (family === "ethereum") {
      validateByteLength(input.previousIdentifier, {
        field: "previousIdentifier",
        expectedBytes: ETH_ADDRESS_BYTES,
      });
      validateByteLength(input.newIdentifier, {
        field: "newIdentifier",
        expectedBytes: ETH_ADDRESS_BYTES,
      });
      // CHAIN_ID is mandatory for the Ethereum family (multiple networks share
      // the same address format).
      if (input.chainId === undefined) {
        throw new ContactsValidationError(
          "chainId is required for the Ethereum blockchain family.",
        );
      }
    } else {
      if (input.previousIdentifier.length === 0) {
        throw new ContactsValidationError(
          "previousIdentifier must not be empty.",
        );
      }
      if (input.newIdentifier.length === 0) {
        throw new ContactsValidationError("newIdentifier must not be empty.");
      }
    }

    if (input.chainId !== undefined) {
      validateChainId(input.chainId);
    }

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
